import { Injectable, Logger } from '@nestjs/common';
import { PostStatus, PostType, PROVINCE_NAME, WARDS, canonicalWardName, normalizeVietnamese, searchWards, stripTagsBlock } from '@phuochai/shared';
import type { PostInput } from '@phuochai/shared';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { PrismaService } from '../prisma/prisma.service';
import { PostsService, type Viewer } from '../posts/posts.service';
import { mcpConfig } from './mcp.config';
import type { McpAuthContext } from './api-tokens.service';
import { McpAuditService } from './mcp-audit.service';

/** Lỗi nghiệp vụ trả về cho agent (message đã an toàn để hiển thị). */
export class McpToolError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'McpToolError';
  }
}

/** Giới hạn đầu vào tool. */
const LIMITS = {
  titleMin: 5,
  titleMax: 300,
  summaryMax: 1000,
  markdownMax: 200_000,
  tagsMax: 20,
  searchLimit: 10,
};

/** Thẻ HTML được giữ lại sau khi sanitize (chặn script/iframe lạ). */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'blockquote',
    'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption', 'table', 'thead', 'tbody',
    'tr', 'th', 'td', 'hr', 'code', 'pre', 'span', 'div',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    '*': ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', ''] },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    img: sanitizeHtml.simpleTransform('img', {}),
  },
  disallowedTagsMode: 'discard',
};

/** Chuẩn hoá gạch dài về gạch nối (quy ước nội dung của site). */
function normalizeDashes(value: string): string {
  return value.replace(/[\u2014\u2013]/g, '-');
}

/** Markdown -> HTML đã sanitize, bỏ khối "Tags:" nếu agent copy từ nguồn khác. */
function markdownToHtml(markdown: string): string {
  const html = marked.parse(markdown, { async: false, gfm: true, breaks: false }) as string;
  return sanitizeHtml(normalizeDashes(stripTagsBlock(html) ?? html), SANITIZE_OPTIONS);
}

/** HTML do agent gửi -> sanitize (giữ cấu trúc nhưng bỏ thẻ nguy hiểm). */
function cleanHtml(html: string): string {
  return sanitizeHtml(normalizeDashes(stripTagsBlock(html) ?? html), SANITIZE_OPTIONS);
}

/**
 * Các tool MCP cho AI agent viết nội dung.
 *
 * Nguyên tắc: agent chỉ **tạo bản nháp** (DRAFT). Việc xuất bản do người duyệt
 * hoặc token có scope `posts:publish` (Phase 2).
 */
@Injectable()
export class McpToolsService {
  private readonly logger = new Logger(McpToolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
    private readonly audit: McpAuditService,
  ) {}

  /** Thông tin về token và giới hạn để agent biết mình được làm gì. */
  async whoami(auth: McpAuthContext) {
    return {
      user: { name: auth.user.name, email: auth.user.email, role: auth.user.role },
      token: { name: auth.tokenName, agentName: auth.agentName, scopes: auth.scopes },
      site: {
        name: 'Làng Chài Phước Hải',
        url: mcpConfig.siteUrl,
        province: PROVINCE_NAME,
        contentTypes: Object.values(PostType),
        statuses: 'Agent chỉ tạo/sửa được bản nháp (DRAFT)',
      },
      limits: {
        requestsPerMinute: mcpConfig.rateLimitPerMin,
        postsPerDay: mcpConfig.dailyPostLimit,
        titleLength: `${LIMITS.titleMin}-${LIMITS.titleMax}`,
        tagsPerPost: LIMITS.tagsMax,
        markdownLength: LIMITS.markdownMax,
      },
      workflow: [
        '1. list_categories + list_wards để chọn đúng danh mục và xã/phường',
        '2. search_posts để kiểm tra bài đã tồn tại chưa',
        '3. create_post với contentMarkdown (không gửi HTML nếu không cần)',
        '4. Báo người quản trị duyệt và xuất bản trong trang quản trị',
      ],
    };
  }

  /** Danh mục để agent chọn categorySlug. */
  async listCategories(input: { section?: PostType | null }) {
    const rows = await this.prisma.category.findMany({
      where: input.section ? { section: input.section } : undefined,
      orderBy: [{ section: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        section: true,
        level: true,
        isLocationFilter: true,
        parentId: true,
        _count: { select: { posts: true } },
      },
      take: 300,
    });

    return rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      section: row.section,
      level: row.level,
      isLocationFilter: row.isLocationFilter,
      parentSlug: null as string | null,
      postCount: row._count.posts,
    }));
  }

  /** 168 xã/phường để agent truyền đúng `ward`. */
  async listWards(input: { query?: string | null }) {
    const wards = input.query ? searchWards(input.query, 30) : WARDS;
    return wards.map((ward) => ({ name: ward.name, code: ward.code }));
  }

  /** Tìm bài đã có để tránh tạo trùng. */
  async searchPosts(input: {
    keyword?: string | null;
    type?: PostType | null;
    status?: PostStatus | null;
    limit?: number | null;
  }) {
    const limit = Math.min(Math.max(input.limit ?? LIMITS.searchLimit, 1), 30);
    const keyword = input.keyword?.trim();

    const rows = await this.prisma.post.findMany({
      where: {
        ...(input.type ? { type: input.type } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(keyword
          ? {
              OR: [
                { title: { contains: keyword, mode: 'insensitive' } },
                { slug: { contains: keyword, mode: 'insensitive' } },
                { summary: { contains: keyword, mode: 'insensitive' } },
                { contentText: { contains: keyword, mode: 'insensitive' } },
                { tags: { some: { name: { contains: keyword, mode: 'insensitive' } } } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: { id: true, slug: true, title: true, type: true, status: true, summary: true, updatedAt: true },
    });

    return rows.map((row) => ({ ...row, url: `${mcpConfig.siteUrl}${this.postPath(row.type, row.slug)}` }));
  }

  /** Chi tiết một bài để agent tham khảo/không tạo trùng. */
  async getPost(input: { id?: string | null; slug?: string | null }) {
    if (!input.id && !input.slug) throw new McpToolError('INVALID_INPUT', 'Cần truyền id hoặc slug');

    const post = await this.prisma.post.findFirst({
      where: input.id ? { id: input.id } : { slug: input.slug as string },
      include: {
        category: { select: { slug: true, name: true } },
        images: { orderBy: { sortOrder: 'asc' }, select: { path: true, alt: true, role: true } },
        tags: { select: { name: true } },
      },
    });

    if (!post) throw new McpToolError('NOT_FOUND', 'Không tìm thấy bài viết');

    return {
      id: post.id,
      slug: post.slug,
      type: post.type,
      status: post.status,
      title: post.title,
      summary: post.summary,
      contentHtml: (post.contentHtml ?? '').slice(0, 200_000),
      url: `${mcpConfig.siteUrl}${this.postPath(post.type, post.slug)}`,
      category: post.category ? { slug: post.category.slug, name: post.category.name } : null,
      tags: post.tags.map((tag) => tag.name),
      ward: post.ward,
      addressRaw: post.addressRaw,
      priceRaw: post.priceRaw,
      areaText: post.areaText,
      images: post.images.map((image) => ({ path: image.path, alt: image.alt, role: image.role })),
      updatedAt: post.updatedAt,
      createdAt: post.createdAt,
    };
  }

  /**
   * Tạo bài mới ở trạng thái DRAFT.
   *
   * - Ưu tiên `contentMarkdown`; nếu chỉ có `contentHtml` thì sanitize rồi dùng.
   * - Danh mục phải tồn tại (theo slug), xã/phường phải thuộc 168 đơn vị TP.HCM.
   * - `idempotencyKey` giúp agent retry không tạo trùng.
   */
  async createPost(
    auth: McpAuthContext,
    input: {
      type: PostType;
      title: string;
      slug?: string | null;
      summary?: string | null;
      contentMarkdown?: string | null;
      contentHtml?: string | null;
      categorySlug: string;
      tags?: string[];
      ward?: string | null;
      addressRaw?: string | null;
      priceRaw?: string | null;
      areaText?: string | null;
      bedrooms?: number | null;
      bathrooms?: number | null;
      seoTitle?: string | null;
      idempotencyKey?: string | null;
    },
  ) {
    const title = input.title.trim();
    if (title.length < LIMITS.titleMin) {
      throw new McpToolError('INVALID_INPUT', `Tiêu đề tối thiểu ${LIMITS.titleMin} ký tự`);
    }
    if (title.length > LIMITS.titleMax) {
      throw new McpToolError('INVALID_INPUT', `Tiêu đề tối đa ${LIMITS.titleMax} ký tự`);
    }

    const markdown = input.contentMarkdown?.trim() ?? '';
    const rawHtml = input.contentHtml?.trim() ?? '';
    if (!markdown && !rawHtml) {
      throw new McpToolError('INVALID_INPUT', 'Cần truyền contentMarkdown hoặc contentHtml');
    }
    if (markdown.length > LIMITS.markdownMax) {
      throw new McpToolError('INVALID_INPUT', `Nội dung quá dài (tối đa ${LIMITS.markdownMax} ký tự)`);
    }

    const category = await this.prisma.category.findUnique({
      where: { slug: input.categorySlug.trim() },
      select: { id: true, name: true, slug: true },
    });
    if (!category) {
      const suggestions = await this.prisma.category.findMany({
        where: { slug: { contains: input.categorySlug.trim().slice(0, 8) } },
        select: { slug: true, name: true },
        take: 5,
      });
      throw new McpToolError(
        'INVALID_CATEGORY',
        `Danh mục "${input.categorySlug}" không tồn tại.` +
          (suggestions.length > 0
            ? ` Gợi ý: ${suggestions.map((item) => `${item.slug} (${item.name})`).join(', ')}`
            : ' Dùng list_categories để xem danh sách.'),
      );
    }

    const ward = this.normalizeWard(input.ward);
    const tags = [...new Set((input.tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
    if (tags.length > LIMITS.tagsMax) {
      throw new McpToolError('INVALID_INPUT', `Tối đa ${LIMITS.tagsMax} tag`);
    }

    // Idempotency: trả lại bài cũ nếu agent gọi lại cùng key
    const idempotencyKey = input.idempotencyKey?.trim();
    if (idempotencyKey) {
      const existing = await this.prisma.mcpIdempotency.findUnique({
        where: { tokenId_key: { tokenId: auth.tokenId, key: idempotencyKey } },
        select: { postId: true },
      });
      if (existing?.postId) {
        const post = await this.prisma.post.findUnique({
          where: { id: existing.postId },
          select: { id: true, slug: true, status: true, title: true },
        });
        if (post) return { ...post, url: `${mcpConfig.siteUrl}${this.postPath(input.type, post.slug)}`, reused: true };
      }
    }

    const postsToday = await this.audit.countPostsToday(auth.tokenId);
    if (postsToday >= mcpConfig.dailyPostLimit) {
      throw new McpToolError(
        'QUOTA_EXCEEDED',
        `Đã đạt giới hạn ${mcpConfig.dailyPostLimit} bài/ngày cho token này. Thử lại vào ngày mai.`,
      );
    }

    const contentHtml = markdown ? markdownToHtml(markdown) : cleanHtml(rawHtml);
    const summary = input.summary?.trim() || this.deriveSummary(contentHtml);

    const payload = {
      type: input.type,
      status: PostStatus.DRAFT,
      title: normalizeDashes(title),
      slug: input.slug?.trim() || undefined,
      summary: summary ? normalizeDashes(summary.slice(0, LIMITS.summaryMax)) : undefined,
      contentHtml,
      seoTitle: input.seoTitle?.trim() || undefined,
      categoryId: category.id,
      tags,
      ward: ward ?? undefined,
      city: PROVINCE_NAME,
      addressRaw: input.addressRaw?.trim() || undefined,
      priceRaw: input.priceRaw?.trim() || undefined,
      areaText: input.areaText?.trim() || undefined,
      bedrooms: input.bedrooms ?? undefined,
      bathrooms: input.bathrooms ?? undefined,
      attributes: {},
      images: [],
    } as unknown as PostInput;

    const viewer: Viewer = {
      id: auth.user.id,
      role: auth.user.role as Viewer['role'],
      email: auth.user.email,
      name: auth.user.name,
    };

    const created = await this.posts.create(payload, viewer);

    // Ghi lại meta của agent vào extras để truy vết trong admin
    await this.prisma.post.update({
      where: { id: created.id },
      data: {
        extras: {
          agent: {
            tokenId: auth.tokenId,
            tokenName: auth.tokenName,
            agentName: auth.agentName,
            createdAt: new Date().toISOString(),
          },
        } as never,
      },
    });

    if (idempotencyKey) {
      await this.prisma.mcpIdempotency
        .create({ data: { tokenId: auth.tokenId, key: idempotencyKey, postId: created.id } })
        .catch(() => undefined);
    }

    return {
      id: created.id,
      slug: created.slug,
      status: created.status,
      title: created.title,
      url: `${mcpConfig.siteUrl}${this.postPath(input.type, created.slug)}`,
      reused: false,
    };
  }

  /** Đường dẫn công khai của bài viết (khớp với frontend). */
  postPath(type: PostType, slug: string): string {
    switch (type) {
      case PostType.ACCOMMODATION:
        return `/luu-tru/${slug}`;
      case PostType.NEWS:
        return `/tin-tuc/${slug}`;
      case PostType.REAL_ESTATE:
        return `/bat-dong-san/${slug}`;
      default:
        return `/trang/${slug}`;
    }
  }

  /** Xã/phường: chuẩn hoá theo danh mục 168 đơn vị, báo lỗi kèm gợi ý nếu sai. */
  private normalizeWard(value: string | null | undefined): string | null {
    const raw = value?.trim();
    if (!raw) return null;

    const canonical = canonicalWardName(raw);
    if (canonical) return canonical;

    const suggestions = searchWards(raw, 5).map((ward) => ward.name);
    throw new McpToolError(
      'INVALID_WARD',
      `Xã/phường "${raw}" không có trong danh mục TP. Hồ Chí Minh.` +
        (suggestions.length > 0 ? ` Gợi ý: ${suggestions.join(', ')}` : ' Dùng list_wards để xem danh sách.'),
    );
  }

  /** Tóm tắt tự động từ nội dung nếu agent không truyền summary. */
  private deriveSummary(html: string): string | null {
    const text = html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return null;
    return text.slice(0, 300);
  }

  /** Đếm từ khoá để gợi ý tag (dùng ở Phase 2). */
  normalizeKeyword(value: string): string {
    return normalizeVietnamese(value);
  }
}
