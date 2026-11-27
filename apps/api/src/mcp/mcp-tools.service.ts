import { Injectable, Logger } from '@nestjs/common';
import { PostStatus, PostType, PROVINCE_NAME, Role, WARDS, canPublish, canonicalWardName, normalizeVietnamese, searchWards, stripTagsBlock } from '@phuochai/shared';
import type { PostInput } from '@phuochai/shared';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookQueueService } from '../posts/facebook-queue.service';
import { FacebookService } from '../posts/facebook.service';
import { PostsService, type Viewer } from '../posts/posts.service';
import { UploadsService } from '../uploads/uploads.service';
import { normalizeNewsSeo } from './news-seo';
import { AffiliateService } from '../affiliate/affiliate.service';
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

/** Trạng thái agent được phép chuyển qua tool set_post_status. */
const MCP_STATUS_VALUES = [PostStatus.DRAFT, PostStatus.PUBLISHED, PostStatus.ARCHIVED] as const;

/** Thẻ HTML được giữ lại sau khi sanitize (chặn script/iframe lạ). */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'blockquote',
    'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption', 'table', 'thead', 'tbody',
    'tr', 'th', 'td', 'hr', 'code', 'pre', 'span', 'div',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel', 'id'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    '*': ['class', 'id'],
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
    private readonly facebook: FacebookService,
    private readonly facebookQueue: FacebookQueueService,
    private readonly affiliate: AffiliateService,
    private readonly uploads: UploadsService,
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
        statuses: mcpConfig.allowPublish
          ? 'Tạo/sửa bản nháp; có thể publish/unpublish/archive nếu token có posts:publish; xoá chỉ ADMIN'
          : 'Tạo/sửa bản nháp; server đang tắt publish (MCP_ALLOW_PUBLISH=false), vẫn unpublish/archive được nếu token có posts:publish; xoá chỉ ADMIN',
        publishEnabled: mcpConfig.allowPublish,
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
        '4. update_post nếu cần sửa bài nháp',
        '5. set_post_status chỉ khi được yêu cầu publish/unpublish/archive',
        '6. delete_post chỉ ADMIN, cần confirmSlug chính xác',
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

  /** Danh sách bài NEWS có phân trang + chỉ số SEO cơ bản để audit hàng loạt. */
  async listNewsPosts(input: { page?: number | null; limit?: number | null; status?: PostStatus | null }) {
    const limit = Math.min(Math.max(input.limit ?? 30, 1), 50);
    const page = Math.max(input.page ?? 1, 1);
    const where = {
      type: PostType.NEWS,
      ...(input.status ? { status: input.status } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          summary: true,
          seoTitle: true,
          contentHtml: true,
          updatedAt: true,
          publishedAt: true,
          images: { where: { role: 'hero' }, select: { id: true } },
        },
      }),
    ]);

    return {
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
      items: rows.map((row) => {
        const html = row.contentHtml ?? '';
        return {
          id: row.id,
          slug: row.slug,
          title: row.title,
          status: row.status,
          summaryLength: row.summary?.trim().length ?? 0,
          seoTitle: row.seoTitle,
          seoTitleLength: row.seoTitle?.trim().length ?? 0,
          contentLength: html.length,
          hasToc: /id=["']main-toc["']/i.test(html),
          h2Count: (html.match(/<h2\b/gi) ?? []).length,
          h2WithId: (html.match(/<h2[^>]*\bid=/gi) ?? []).length,
          h3Count: (html.match(/<h3\b/gi) ?? []).length,
          imageCount: (html.match(/<img\b/gi) ?? []).length,
          linkCount: (html.match(/<a\b/gi) ?? []).length,
          hasHero: row.images.length > 0,
          updatedAt: row.updatedAt,
          publishedAt: row.publishedAt,
        };
      }),
    };
  }

  /**
   * Audit/apply chuẩn hoá SEO cho một trang bài NEWS.
   *
   * dryRun mặc định true. Khi apply bài PUBLISHED, token phải có posts:publish
   * vì nội dung đang sống sẽ được cập nhật trực tiếp (không đổi trạng thái).
   */
  async formatNewsPosts(
    auth: McpAuthContext,
    input: { page?: number | null; limit?: number | null; status?: PostStatus | null; dryRun?: boolean | null },
  ) {
    const dryRun = input.dryRun !== false;
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 20);
    const page = Math.max(input.page ?? 1, 1);
    const where = {
      type: PostType.NEWS,
      ...(input.status ? { status: input.status } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, slug: true, title: true, status: true, summary: true, seoTitle: true, contentHtml: true },
      }),
    ]);

    if (!dryRun && rows.some((row) => row.status !== PostStatus.DRAFT) && !auth.scopes.includes('posts:publish')) {
      throw new McpToolError('FORBIDDEN', 'Cần scope posts:publish để sửa bài đã publish.');
    }

    const items = [];
    for (const row of rows) {
      const result = normalizeNewsSeo(row.contentHtml ?? '', row.title, row.summary, row.seoTitle);
      const changed = result.changes.length > 0;

      if (!dryRun && changed) {
        await this.prisma.post.update({
          where: { id: row.id },
          data: { contentHtml: result.html, seoTitle: result.seoTitle, summary: result.summary },
        });
      }

      items.push({
        id: row.id,
        slug: row.slug,
        status: row.status,
        changed,
        dryRun,
        changes: result.changes,
        before: result.before,
        after: result.after,
      });
    }

    return { dryRun, page, pageSize: limit, total, totalPages: Math.ceil(total / limit), items };
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
      seoTitle: post.seoTitle,
      facebookCaption: post.facebookCaption,
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

  /** Upload ảnh base64 từ MCP, trả path public để chèn vào content. */
  async uploadImage(input: {
    dataBase64: string;
    filename: string;
    mimeType: string;
    alt?: string | null;
    watermark?: boolean | null;
  }) {
    const raw = input.dataBase64.replace(/^data:[^;]+;base64,/, '').trim();
    if (!raw) throw new McpToolError('INVALID_INPUT', 'Thiếu dữ liệu ảnh base64');
    if (raw.length > 4_000_000) throw new McpToolError('INVALID_INPUT', 'Ảnh base64 quá lớn (tối đa khoảng 4MB)');

    const buffer = Buffer.from(raw, 'base64');
    if (buffer.length === 0) throw new McpToolError('INVALID_INPUT', 'Dữ liệu ảnh không hợp lệ');

    const result = await this.uploads.save(
      {
        originalname: input.filename,
        mimetype: input.mimeType,
        size: buffer.length,
        buffer,
      },
      'posts',
      { watermark: input.watermark ?? false },
    );

    return {
      ...result,
      alt: input.alt ?? input.filename,
      markdown: `![${input.alt ?? input.filename}](${result.path})`,
    };
  }

  /** Danh mục link affiliate đang hoạt động để agent chọn sản phẩm liên quan. */
  async listAffiliateLinks(input: {
    query?: string | null;
    campaign?: string | null;
    active?: boolean | null;
    limit?: number | null;
  }) {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
    const result = await this.affiliate.list({
      query: input.query ?? undefined,
      campaign: input.campaign ?? undefined,
      active: input.active ?? true,
      page: 1,
      pageSize: limit,
    });

    return {
      total: result.total,
      items: result.items.map(({ destinationUrl: _destinationUrl, ...link }) => ({
        ...link,
        url: `${mcpConfig.siteUrl}/go/${link.slug}`,
        shortcode: `[[affiliate:${link.slug}]]`,
      })),
    };
  }

  /** Kiểm tra slug affiliate trước khi agent chèn shortcode vào bài. */
  async validateAffiliateLinks(input: { slugs: string[] }) {
    const slugs = [...new Set(input.slugs.map((slug) => slug.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
    if (slugs.length === 0) throw new McpToolError('INVALID_INPUT', 'Cần truyền ít nhất một slug affiliate');

    const rows = await this.prisma.affiliateLink.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true, title: true, isActive: true },
    });
    const bySlug = new Map(rows.map((row) => [row.slug, row]));

    return {
      valid: rows.filter((row) => row.isActive).map((row) => ({ slug: row.slug, title: row.title })),
      inactive: rows.filter((row) => !row.isActive).map((row) => ({ slug: row.slug, title: row.title })),
      missing: slugs.filter((slug) => !bySlug.has(slug)),
    };
  }

  /** Gán ảnh hero cho bài DRAFT; ảnh phải là file đã upload trong /upload/. */
  async setPostHero(input: { id?: string | null; slug?: string | null; imagePath: string; alt?: string | null }) {
    const current = await this.findPostRef(input);
    if (current.status !== PostStatus.DRAFT) {
      throw new McpToolError('POST_NOT_DRAFT', 'Chỉ được set hero cho bài DRAFT. Hãy đưa bài về nháp trước.');
    }

    const imagePath = input.imagePath.trim();
    if (!imagePath.startsWith('/upload/')) {
      throw new McpToolError('INVALID_INPUT', 'imagePath phải là đường dẫn /upload/... đã upload');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.postImage.updateMany({
        where: { postId: current.id, role: 'hero' },
        data: { role: 'gallery' },
      });
      const existing = await tx.postImage.findFirst({
        where: { postId: current.id, path: imagePath },
        select: { id: true },
      });
      if (existing) {
        await tx.postImage.update({
          where: { id: existing.id },
          data: { role: 'hero', alt: input.alt?.slice(0, 300) ?? null, sortOrder: 0 },
        });
      } else {
        await tx.postImage.create({
          data: {
            postId: current.id,
            path: imagePath,
            role: 'hero',
            alt: input.alt?.slice(0, 300) ?? null,
            sortOrder: 0,
          },
        });
      }
    });

    return {
      id: current.id,
      slug: current.slug,
      status: current.status,
      heroImage: imagePath,
      url: `${mcpConfig.siteUrl}${this.postPath(current.type, current.slug)}`,
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
      facebookCaption?: string | null;
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
      facebookCaption: input.facebookCaption?.trim() || undefined,
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

  /**
   * Cập nhật bài đang ở trạng thái DRAFT.
   *
   * Không cho sửa bài đã publish/archive để tránh agent vô tình thay đổi
   * nội dung đang chạy; muốn đổi trạng thái dùng `set_post_status`.
   */
  async updatePost(
    auth: McpAuthContext,
    input: {
      id?: string | null;
      slug?: string | null;
      newSlug?: string | null;
      title?: string | null;
      summary?: string | null;
      contentMarkdown?: string | null;
      contentHtml?: string | null;
      categorySlug?: string | null;
      tags?: string[] | null;
      ward?: string | null;
      addressRaw?: string | null;
      priceRaw?: string | null;
      areaText?: string | null;
      bedrooms?: number | null;
      bathrooms?: number | null;
      seoTitle?: string | null;
      facebookCaption?: string | null;
    },
  ) {
    const current = await this.findPostRef(input);
    if (current.status !== PostStatus.DRAFT) {
      throw new McpToolError(
        'POST_NOT_DRAFT',
        `Chỉ được sửa bài DRAFT. Bài hiện tại đang ở trạng thái ${current.status}.`,
      );
    }

    const data: Partial<PostInput> = {};
    let hasChanges = false;

    if (input.title != null) {
      const title = normalizeDashes(input.title.trim());
      if (title.length < LIMITS.titleMin || title.length > LIMITS.titleMax) {
        throw new McpToolError('INVALID_INPUT', `Tiêu đề phải từ ${LIMITS.titleMin} đến ${LIMITS.titleMax} ký tự`);
      }
      data.title = title;
      // Đổi tiêu đề không tự đổi URL; chỉ đổi khi agent truyền newSlug.
      if (!input.newSlug?.trim()) data.slug = current.slug;
      hasChanges = true;
    }

    if (input.newSlug != null) {
      const newSlug = input.newSlug.trim();
      if (newSlug) {
        data.slug = newSlug;
        hasChanges = true;
      }
    }

    if (input.summary != null) {
      data.summary = normalizeDashes(input.summary.trim()).slice(0, LIMITS.summaryMax);
      hasChanges = true;
    }

    const markdown = input.contentMarkdown?.trim() ?? '';
    const rawHtml = input.contentHtml?.trim() ?? '';
    if (markdown || rawHtml) {
      if (markdown.length > LIMITS.markdownMax) {
        throw new McpToolError('INVALID_INPUT', `Nội dung quá dài (tối đa ${LIMITS.markdownMax} ký tự)`);
      }
      data.contentHtml = markdown ? markdownToHtml(markdown) : cleanHtml(rawHtml);
      hasChanges = true;
    }

    if (input.categorySlug != null) {
      const category = await this.prisma.category.findUnique({
        where: { slug: input.categorySlug.trim() },
        select: { id: true },
      });
      if (!category) {
        throw new McpToolError('INVALID_CATEGORY', `Danh mục "${input.categorySlug}" không tồn tại`);
      }
      data.categoryId = category.id;
      hasChanges = true;
    }

    if (input.tags != null) {
      const tags = [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))];
      if (tags.length > LIMITS.tagsMax) throw new McpToolError('INVALID_INPUT', `Tối đa ${LIMITS.tagsMax} tag`);
      data.tags = tags;
      hasChanges = true;
    }

    if (input.ward != null) {
      const ward = this.normalizeWard(input.ward);
      if (ward) {
        data.ward = ward;
        hasChanges = true;
      }
    }

    if (input.addressRaw != null) {
      data.addressRaw = input.addressRaw.trim() || undefined;
      hasChanges = true;
    }
    if (input.priceRaw != null) {
      data.priceRaw = input.priceRaw.trim() || undefined;
      hasChanges = true;
    }
    if (input.areaText != null) {
      data.areaText = input.areaText.trim() || undefined;
      hasChanges = true;
    }
    if (input.facebookCaption != null) {
      data.facebookCaption = input.facebookCaption.trim() || undefined;
      hasChanges = true;
    }

    if (input.seoTitle != null) {
      data.seoTitle = input.seoTitle.trim() || undefined;
      hasChanges = true;
    }
    if (input.bedrooms != null) {
      data.bedrooms = input.bedrooms;
      hasChanges = true;
    }
    if (input.bathrooms != null) {
      data.bathrooms = input.bathrooms;
      hasChanges = true;
    }

    if (!hasChanges) {
      throw new McpToolError('INVALID_INPUT', 'Không có trường nào cần cập nhật');
    }

    const updated = await this.posts.update(
      { ...data, id: current.id } as PostInput & { id: string },
      this.viewer(auth),
    );

    return {
      id: updated.id,
      slug: updated.slug,
      title: updated.title,
      status: updated.status,
      url: `${mcpConfig.siteUrl}${this.postPath(updated.type, updated.slug)}`,
    };
  }

  /** Xuất bản, thu hồi về nháp hoặc lưu trữ bài viết. */
  async setPostStatus(
    auth: McpAuthContext,
    input: { id?: string | null; slug?: string | null; status: PostStatus },
  ) {
    if (!MCP_STATUS_VALUES.includes(input.status)) {
      throw new McpToolError('INVALID_INPUT', `Trạng thái không hợp lệ: ${input.status}`);
    }
    // Công tắc phía server: kể cả token có scope posts:publish cũng không xuất bản được
    // khi MCP_ALLOW_PUBLISH khác "true". Thu hồi về nháp/lưu trữ vẫn được phép.
    if (input.status === PostStatus.PUBLISHED && !mcpConfig.allowPublish) {
      throw new McpToolError(
        'PUBLISH_DISABLED',
        'Máy chủ đang tắt xuất bản qua MCP (MCP_ALLOW_PUBLISH=false). Bài vẫn giữ trạng thái hiện tại; ' +
          'hãy để biên tập viên xuất bản trong trang quản trị.',
      );
    }

    const current = await this.findPostRef(input);
    const updated = await this.posts.setStatus(current.id, input.status, this.viewer(auth));

    return {
      id: updated.id,
      slug: updated.slug,
      title: updated.title,
      status: updated.status,
      url: `${mcpConfig.siteUrl}${this.postPath(updated.type, updated.slug)}`,
    };
  }

  /** Xoá vĩnh viễn bài viết; chỉ ADMIN và phải xác nhận đúng slug. */
  async deletePost(
    auth: McpAuthContext,
    input: { id?: string | null; slug?: string | null; confirmSlug: string },
  ) {
    if (auth.user.role !== Role.ADMIN) {
      throw new McpToolError('FORBIDDEN', 'Chỉ ADMIN mới được xoá bài viết');
    }

    const current = await this.findPostRef(input);
    if (input.confirmSlug.trim() !== current.slug) {
      throw new McpToolError(
        'CONFIRM_MISMATCH',
        `Slug xác nhận không khớp. Bài cần xoá có slug "${current.slug}".`,
      );
    }

    await this.posts.remove(current.id, this.viewer(auth));

    return {
      id: current.id,
      slug: current.slug,
      title: current.title,
      status: current.status,
      deleted: true,
    };
  }

  /** Đăng một bài đã PUBLISHED lên Facebook Page ngay, không đổi trạng thái bài. */
  async postToFacebook(
    auth: McpAuthContext,
    input: { id?: string | null; slug?: string | null; caption?: string | null },
  ) {
    this.assertFacebookAccess(auth);
    if (!mcpConfig.allowPublish) {
      throw new McpToolError('PUBLISH_DISABLED', 'Máy chủ đang tắt xuất bản qua MCP (MCP_ALLOW_PUBLISH=false).');
    }
    const ref = await this.findPostRef(input);
    if (ref.status !== PostStatus.PUBLISHED) {
      throw new McpToolError('POST_NOT_PUBLISHED', 'Chỉ đăng Facebook cho bài đã PUBLISHED.');
    }
    if (ref.type === PostType.PAGE) {
      throw new McpToolError('INVALID_INPUT', 'Không đăng trang tĩnh (PAGE) lên Facebook.');
    }

    const caption = input.caption?.trim();
    const post = await this.prisma.post.update({
      where: { id: ref.id },
      data: caption ? { facebookCaption: caption } : {},
      select: { id: true, slug: true, type: true, title: true, summary: true, facebookCaption: true, facebookPostId: true },
    });
    if (post.facebookPostId) {
      throw new McpToolError(
        'ALREADY_POSTED',
        `Bài đã được đăng Facebook (${post.facebookPostId}). Dùng unpost_from_facebook trước nếu muốn đăng lại.`,
      );
    }

    let facebookPostId: string | null;
    try {
      facebookPostId = await this.facebook.postNow(post);
    } catch (err) {
      throw new McpToolError('FACEBOOK_ERROR', (err as Error).message);
    }
    return { id: post.id, slug: post.slug, title: post.title, facebookPostId };
  }

  /** Xoá bài khỏi Facebook Page và xoá facebookPostId; bài trên website giữ nguyên. */
  async unpostFromFacebook(auth: McpAuthContext, input: { id?: string | null; slug?: string | null }) {
    this.assertFacebookAccess(auth);
    const ref = await this.findPostRef(input);
    const post = await this.prisma.post.findUniqueOrThrow({
      where: { id: ref.id },
      select: { id: true, slug: true, title: true, facebookPostId: true },
    });
    if (!post.facebookPostId) {
      throw new McpToolError('NOT_POSTED', 'Bài này chưa được đăng lên Facebook.');
    }
    try {
      await this.facebook.unpostNow(post.id, post.facebookPostId);
    } catch (err) {
      await this.prisma.post.update({ where: { id: post.id }, data: { facebookPostId: post.facebookPostId } });
      throw new McpToolError('FACEBOOK_ERROR', (err as Error).message);
    }
    return { id: post.id, slug: post.slug, title: post.title, removedFacebookPostId: post.facebookPostId };
  }

  /** Bài PUBLISHED chưa có facebookCaption (cũ nhất trước) kèm đoạn đầu nội dung để soạn caption. */
  async listPostsMissingFacebookCaption(input: { limit?: number | null; onlyNews?: boolean | null }) {
    const limit = Math.min(Math.max(input.limit ?? 10, 1), 30);
    const where = {
      status: PostStatus.PUBLISHED,
      type: input.onlyNews === false ? { not: PostType.PAGE } : PostType.NEWS,
      OR: [{ facebookCaption: null }, { facebookCaption: '' }],
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.post.count({ where }),
      this.prisma.post.findMany({
        where,
        orderBy: [{ publishedAt: 'asc' }, { createdAt: 'asc' }],
        take: limit,
        select: {
          id: true,
          slug: true,
          type: true,
          title: true,
          summary: true,
          contentText: true,
          publishedAt: true,
          facebookPostId: true,
        },
      }),
    ]);
    return {
      totalMissing: total,
      items: rows.map(({ contentText, ...row }) => ({
        ...row,
        excerpt: (contentText ?? '').replace(/\s+/g, ' ').trim().slice(0, 1500),
      })),
    };
  }

  /** Lưu facebookCaption cho bài ở bất kỳ trạng thái nào (không đăng, không đổi nội dung khác). */
  async setFacebookCaption(
    auth: McpAuthContext,
    input: { id?: string | null; slug?: string | null; caption: string },
  ) {
    this.assertFacebookAccess(auth);
    const ref = await this.findPostRef(input);
    const caption = input.caption.trim();
    const post = await this.prisma.post.update({
      where: { id: ref.id },
      data: { facebookCaption: caption || null },
      select: { id: true, slug: true, title: true, facebookCaption: true, facebookPostId: true },
    });
    return { id: post.id, slug: post.slug, title: post.title, captionLength: post.facebookCaption?.length ?? 0 };
  }

  async getFacebookQueue(auth: McpAuthContext) {
    this.assertQueueAdmin(auth);
    return this.facebookQueue.status();
  }

  async setFacebookQueue(
    auth: McpAuthContext,
    input: { enabled?: boolean | null; postTimes?: string[] | null; onlyNews?: boolean | null },
  ) {
    this.assertQueueAdmin(auth);
    try {
      return await this.facebookQueue.updateConfig({
        enabled: input.enabled ?? undefined,
        postTimes: input.postTimes ?? undefined,
        onlyNews: input.onlyNews ?? undefined,
      });
    } catch (err) {
      throw new McpToolError('INVALID_INPUT', (err as Error).message);
    }
  }

  private assertQueueAdmin(auth: McpAuthContext): void {
    if (auth.user.role !== Role.ADMIN) {
      throw new McpToolError('FORBIDDEN', 'Chỉ ADMIN mới xem/chỉnh hàng chờ đăng Facebook');
    }
  }

  private assertFacebookAccess(auth: McpAuthContext): void {
    if (!canPublish(auth.user.role as Role)) {
      throw new McpToolError('FORBIDDEN', 'Chỉ biên tập viên trở lên mới đăng/xoá bài Facebook');
    }
  }

  /** Tìm bài theo id hoặc slug, dùng chung cho các tool thao tác. */
  private async findPostRef(input: { id?: string | null; slug?: string | null }) {
    const id = input.id?.trim();
    const slug = input.slug?.trim();
    if (!id && !slug) {
      throw new McpToolError('INVALID_INPUT', 'Cần truyền id hoặc slug của bài viết');
    }

    const post = await this.prisma.post.findFirst({
      where: id ? { id } : { slug },
      select: { id: true, slug: true, title: true, status: true, type: true, authorId: true },
    });
    if (!post) throw new McpToolError('NOT_FOUND', `Không tìm thấy bài viết${slug ? ` "${slug}"` : ''}`);
    return post;
  }

  /** Viewer dùng cho các kiểm tra quyền của PostsService. */
  private viewer(auth: McpAuthContext): Viewer {
    return {
      id: auth.user.id,
      role: auth.user.role as Viewer['role'],
      email: auth.user.email,
      name: auth.user.name,
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
