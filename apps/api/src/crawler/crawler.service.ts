import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { PostStatus, PostType, UPLOAD, stripTagsBlock, stripTagsText } from '@phuochai/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { CrawlCandidateStatus } from './crawl-status.enum';
import { http as httpConfig, site } from './legacy/config';
import { fetchBinary, fetchHtml, mapLimit } from './legacy/http';
import { parseItem } from './legacy/parse/item';
import { absolutize, isAllowedListingPath, normalizeUrl, withPage } from './legacy/lib/urls';
import type { ItemType, ScrapedItem } from './legacy/types';
import {
  POST_TYPE_BY_ITEM_TYPE,
  buildAddressFromLegacy,
  decodeCandidateId,
  describeLegacyUrl,
  encodeCandidateId,
  normalizeDashes,
  parseCandidateSummary,
  postPath,
  slugifyTitle,
  toLegacyUrl,
  type LegacyUrlInfo,
} from './crawl.utils';


/** Một bài viết tìm thấy trên website cũ (kết quả bước kiểm tra, chưa ghi DB). */
export interface CrawlCandidate {
  /** Handle dùng để import (dữ liệu đã parse được cache theo id này). */
  id: string;
  url: string;
  sourceKey: string;
  slug: string;
  title: string;
  type: PostType;
  itemType: ItemType | null;
  /** Mô tả ngắn của bài (không phải nội dung). */
  description: string | null;
  thumbnailUrl: string | null;
  publishedAt: Date | null;
  status: CrawlCandidateStatus;
  /** Bài đã có trong DB (khi status = EXISTING). */
  existingPostId: string | null;
  existingPostSlug: string | null;
  /** Lý do lỗi (khi status = ERROR). */
  error: string | null;
}

export interface CrawlCheckInput {
  urls?: string[];
  slugs?: string[];
  scanListings?: boolean;
  listingLimit?: number;
}

export interface CrawlCheckResult {
  checked: number;
  candidates: CrawlCandidate[];
  warnings: string[];
}

export interface CrawlImportInput {
  ids: string[];
  status?: PostStatus;
  /** Người thực hiện import - gán làm tác giả bài viết. */
  authorId?: string | null;
}

export interface CrawlImportResult {
  created: CrawlCandidate[];
  skipped: string[];
  errors: string[];
}

/** Số trang danh sách quét tối đa cho mỗi khu vực khi tìm bài mới. */
const MAX_LISTING_PAGES = 12;
const DEFAULT_LISTING_LIMIT = 12;
/** Ngân sách số trang tối đa mỗi lần quét danh sách (tránh crawl quá lâu). */
const MAX_LISTING_FETCHES = 40;

/** Các khu vực danh sách trên site cũ (dùng để quét bài mới). */
const LISTING_SECTIONS = ['/noi-luu-tru', '/tin-tuc.html', '/bat-dong-san.html'];

/** Thứ tự ưu tiên ảnh: hero trước, rồi gallery/nội dung. */
const ROLE_ORDER: Record<string, number> = { hero: 0, gallery: 1, content: 2, category: 3, other: 4 };

/**
 * Dịch vụ crawl bài mới từ website cũ (phuochai.com).
 *
 * Quy trình 2 bước để admin duyệt trước khi ghi dữ liệu:
 *  1. `check()`  - tải trang nhưng **chỉ đọc tiêu đề + mô tả + thông số nhẹ**, đối chiếu DB
 *     -> danh sách bài MỚI/ĐÃ CÓ/LỖI. Không giữ nội dung bài trong RAM.
 *  2. `import()` - chỉ với các id admin đã chọn: tải lại trang, đọc đầy đủ nội dung, tải ảnh
 *     về `/upload`, tạo Post (mặc định DRAFT để duyệt tiếp trước khi xuất bản).
 *
 * Id của candidate chính là URL đã mã hoá (base64url) nên server **không cần cache**;
 * đổi lại mỗi lần xem/import sẽ tải lại trang một lần.
 */
@Injectable()
export class CrawlerService {
  private readonly logger = new Logger(CrawlerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  /** Bước 1: kiểm tra bài mới, KHÔNG ghi vào database. */
  async check(input: CrawlCheckInput): Promise<CrawlCheckResult> {
    const warnings: string[] = [];
    const targets = new Set<string>();
    const slugInputs: string[] = [];

    for (const raw of input.urls ?? []) {
      const url = toLegacyUrl(raw);
      if (url) targets.add(url);
      else if (raw.trim()) slugInputs.push(raw.trim());
    }
    for (const raw of input.slugs ?? []) {
      if (!raw.trim()) continue;
      const url = toLegacyUrl(raw);
      if (url) targets.add(url);
      else slugInputs.push(raw.trim());
    }

    const limit = clamp(input.listingLimit ?? DEFAULT_LISTING_LIMIT, 1, 50);

    if (input.scanListings || slugInputs.length > 0) {
      const scan = await this.scanListings(limit);

      for (const slug of slugInputs) {
        const url = scan.bySlug.get(slug.toLowerCase());
        if (url) targets.add(url);
        else warnings.push(`Không tìm thấy slug "${slug}" trong danh sách bài của web cũ.`);
      }

      if (input.scanListings) {
        if (scan.newUrls.length === 0) {
          warnings.push('Quét trang danh sách: không có bài mới nào (tất cả đã có trong database).');
        }
        for (const url of scan.newUrls.slice(0, limit)) targets.add(url);
      }
    }

    if (targets.size === 0) {
      return { checked: 0, candidates: [], warnings };
    }

    const infos = [...targets].map((url) => describeLegacyUrl(url));
    const existing = await this.findExisting(infos);

    const candidates = await mapLimit(infos, httpConfig.concurrency, (info) => this.buildCandidate(info, existing));

    // Đối chiếu thêm bằng slug chuẩn hoá từ tiêu đề (slug của site mới được sinh từ tiêu đề)
    const derivedSlugs = candidates
      .filter((candidate) => candidate.status === CrawlCandidateStatus.NEW)
      .map((candidate) => slugifyTitle(candidate.title));
    if (derivedSlugs.length > 0) {
      const duplicates = await this.prisma.post.findMany({
        where: { slug: { in: derivedSlugs } },
        select: { id: true, slug: true },
      });
      const bySlug = new Map(duplicates.map((row) => [row.slug, row]));
      for (const candidate of candidates) {
        const match = bySlug.get(slugifyTitle(candidate.title));
        if (match && candidate.status === CrawlCandidateStatus.NEW) {
          candidate.status = CrawlCandidateStatus.EXISTING;
          candidate.existingPostId = match.id;
          candidate.existingPostSlug = match.slug;
        }
      }
    }

    const ordered = sortCandidates(candidates);
    return { checked: ordered.length, candidates: ordered, warnings };
  }

  /** Bước 2: import các bài admin đã chọn vào database. */
  async import(input: CrawlImportInput): Promise<CrawlImportResult> {
    if (!input.ids?.length) throw new BadRequestException('Chưa chọn bài nào để import');

    const status = input.status ?? PostStatus.DRAFT;
    const created: CrawlCandidate[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    // Bảng tra để viết lại liên kết trỏ về site cũ -> đường dẫn mới
    const [allPosts, allCategories] = await Promise.all([
      this.prisma.post.findMany({ select: { sourceKey: true, slug: true, type: true } }),
      this.prisma.category.findMany({ select: { slug: true } }),
    ]);
    const postBySourceKey = new Map(
      allPosts.filter((post) => post.sourceKey).map((post) => [post.sourceKey as string, post]),
    );
    const categorySlugs = new Set(allCategories.map((category) => category.slug));
    const usedSlugs = new Set(allPosts.map((post) => post.slug));

    for (const id of input.ids) {
      const url = decodeCandidateId(id);
      if (!url) {
        errors.push('Id bài viết không hợp lệ - hãy bấm "Kiểm tra" lại.');
        continue;
      }

      // Tải lại trang để lấy nội dung đầy đủ (không giữ trong RAM từ bước kiểm tra)
      let item: ScrapedItem;
      let info: LegacyUrlInfo;
      try {
        const html = await fetchHtml(url);
        info = describeLegacyUrl(url);
        item = parseItem(html, url, createHash('sha1').update(html).digest('hex'));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không tải được trang';
        errors.push(`${url}: ${message}`);
        continue;
      }

      const sourceKey = info.sourceKey ?? item.id;
      const exists = await this.prisma.post.findFirst({
        where: { OR: [{ sourceKey }, { slug: slugifyTitle(item.title) }] },
        select: { id: true, slug: true },
      });
      if (exists) {
        skipped.push(`"${item.title}" đã có trong database (slug: ${exists.slug})`);
        continue;
      }

      try {
        const baseSlug = uniqueSlug(slugifyTitle(item.title), usedSlugs);
        const media = await this.downloadImages(item, baseSlug);
        const contentHtml = rewriteContentHtml(item.contentHtml, media.byUrl, {
          postBySourceKey,
          categorySlugs,
        });
        const category = item.category?.slug ?? null;
        const categoryRow =
          category && categorySlugs.has(category)
            ? await this.prisma.category.findUnique({ where: { slug: category }, select: { id: true } })
            : null;

        const address = buildAddressFromLegacy(item.location);
        const tags = await this.resolveTags(item.tags ?? []);

        const post = await this.prisma.post.create({
          data: {
            sourceKey,
            type: POST_TYPE_BY_ITEM_TYPE[item.type] ?? PostType.PAGE,
            status,
            slug: baseSlug,
            title: normalizeDashes(item.title.trim() || baseSlug) ?? baseSlug,
            seoTitle: normalizeDashes(item.seoTitle ?? item.seo?.title ?? null),
            summary: normalizeDashes(item.summary ?? item.seo?.description ?? null),
            contentHtml: normalizeDashes(stripTagsBlock(contentHtml)),
            contentText: normalizeDashes(stripTagsText(item.contentText ?? null)),
            htmlHash: item.htmlHash ?? null,
            code: item.code?.trim() || null,
            views: item.views ?? 0,
            ...address,
            priceRaw: item.price?.raw ?? null,
            priceValue: toBigInt(item.price?.value),
            priceUnit: item.price?.unit ?? null,
            currency: item.price?.currency ?? 'VND',
            pricePerM2Raw: item.price?.perM2Raw ?? null,
            pricePerM2Value: toBigInt(item.price?.perM2Value),
            areaM2: toFloat(item.property?.areaM2),
            areaText: item.property?.areaText ?? null,
            widthM: toFloat(item.property?.widthM),
            lengthM: toFloat(item.property?.lengthM),
            dimensions: item.property?.dimensions ?? null,
            bedrooms: toInt(item.property?.bedrooms),
            bathrooms: toInt(item.property?.bathrooms),
            floors: toInt(item.property?.floors),
            direction: item.property?.direction ?? null,
            roadWidth: item.property?.roadWidth ?? null,
            legal: item.property?.legal ?? null,
            attributes: jsonInput(item.property?.attributes),
            contactName: item.contact?.name ?? null,
            contactPhone: item.contact?.phone ?? null,
            contactEmail: item.contact?.email ?? null,
            contactZalo: item.contact?.zalo ?? null,
            contactCertificate: item.contact?.certificate ?? null,
            contactExperience: item.contact?.experience ?? null,
            verified: item.contact?.verified ?? null,
            hasManager: item.contact?.hasManager ?? null,
            seo: jsonInput(item.seo),
            extras: jsonInput(item.extras),
            warnings: item.warnings ?? [],
            tagsText: tags.map((tag) => tag.name),
            categoryId: categoryRow?.id ?? null,
            authorId: input.authorId ?? null,
            publishedAt: new Date(),
            images: { create: media.images },
            tags: { connect: tags.map((tag) => ({ id: tag.id })) },
          },
          select: { id: true, slug: true, title: true, status: true },
        });

        usedSlugs.add(post.slug);
        created.push({
          id,
          url: info.url,
          sourceKey,
          slug: post.slug,
          title: post.title,
          type: POST_TYPE_BY_ITEM_TYPE[item.type] ?? PostType.PAGE,
          itemType: item.type,
          description: normalizeDashes(item.summary ?? null),
          thumbnailUrl: media.images[0]?.path ?? null,
          publishedAt: new Date(),
          status: CrawlCandidateStatus.NEW,
          existingPostId: null,
          existingPostSlug: null,
          error: null,
        });

        if (media.failures.length > 0) {
          this.logger.warn(`Bài "${post.slug}": ${media.failures.length} ảnh không tải được`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Lỗi không xác định';
        this.logger.error(`Import thất bại (${item.url}): ${message}`);
        errors.push(`"${item.title}": ${message}`);
      }
    }

    return { created, skipped, errors };
  }

  /**
   * Nội dung đầy đủ của một bài (chỉ tải khi admin bấm "Xem").
   * Không lưu lại trong RAM - mỗi lần xem là một lần tải trang.
   */
  async previewContent(id: string): Promise<{ html: string | null; text: string | null }> {
    const url = decodeCandidateId(id);
    if (!url) throw new NotFoundException('Bài viết không hợp lệ - hãy bấm "Kiểm tra" lại.');

    try {
      const html = await fetchHtml(url);
      const item = parseItem(html, url, createHash('sha1').update(html).digest('hex'));
      return { html: item.contentHtml, text: item.contentText };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không tải được nội dung';
      throw new NotFoundException(`Không tải được nội dung: ${message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Nội bộ
  // ---------------------------------------------------------------------------

  /** Tải một trang chi tiết, parse và dựng candidate cho admin duyệt. */
  private async buildCandidate(
    info: LegacyUrlInfo,
    existing: Map<string, { id: string; slug: string }>,
  ): Promise<CrawlCandidate> {
    const id = encodeCandidateId(info.url);
    const base = {
      id,
      url: info.url,
      sourceKey: info.sourceKey ?? '',
      slug: info.legacySlug,
      title: info.legacySlug,
      type: POST_TYPE_BY_ITEM_TYPE[info.itemType ?? 'page'],
      itemType: info.itemType,
      description: null,
      thumbnailUrl: null,
      publishedAt: null,
      existingPostId: null,
      existingPostSlug: null,
      error: null,
    } satisfies Omit<CrawlCandidate, 'status'> & { status?: CrawlCandidateStatus };

    if (!info.itemType) {
      return {
        ...base,
        status: CrawlCandidateStatus.ERROR,
        error: 'URL không phải trang chi tiết bài viết của web cũ (phải có dạng ...-<id>.html).',
      };
    }

    const existingRow = info.sourceKey ? existing.get(info.sourceKey) : undefined;

    try {
      const html = await fetchHtml(info.url);
      // Bước kiểm tra: chỉ đọc tiêu đề + mô tả ngắn (không đọc nội dung, không giữ gì trong RAM)
      const summary = parseCandidateSummary(html, info.url);

      return {
        ...base,
        sourceKey: info.sourceKey ?? info.legacySlug,
        slug: info.legacySlug,
        title: summary.title?.trim() || info.legacySlug,
        type: POST_TYPE_BY_ITEM_TYPE[summary.itemType] ?? PostType.PAGE,
        itemType: summary.itemType,
        description: normalizeDashes(summary.description),
        thumbnailUrl: summary.thumbnailUrl,
        status: existingRow ? CrawlCandidateStatus.EXISTING : CrawlCandidateStatus.NEW,
        existingPostId: existingRow?.id ?? null,
        existingPostSlug: existingRow?.slug ?? null,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không tải được trang';
      return { ...base, status: CrawlCandidateStatus.ERROR, error: message };
    }
  }

  /** Đối chiếu nhanh theo sourceKey và slug gốc của site cũ. */
  private async findExisting(infos: LegacyUrlInfo[]): Promise<Map<string, { id: string; slug: string }>> {
    const keys = infos.map((info) => info.sourceKey).filter((key): key is string => Boolean(key));
    const slugs = infos.map((info) => info.legacySlug).filter(Boolean);

    if (keys.length === 0 && slugs.length === 0) return new Map();

    const rows = await this.prisma.post.findMany({
      where: {
        OR: [
          ...(keys.length > 0 ? [{ sourceKey: { in: keys } }] : []),
          ...(slugs.length > 0 ? [{ slug: { in: slugs } }] : []),
        ],
      },
      select: { id: true, slug: true, sourceKey: true },
    });

    const map = new Map<string, { id: string; slug: string }>();
    for (const row of rows) {
      if (row.sourceKey) map.set(row.sourceKey, { id: row.id, slug: row.slug });
      map.set(row.slug, { id: row.id, slug: row.slug });
    }
    return map;
  }

  /**
   * Quét các trang danh sách của web cũ để tìm bài mới.
   *
   * Trang gốc của web cũ chỉ liệt kê **danh mục**, còn bài viết nằm trong trang danh mục
   * (ví dụ `/noi-luu-tru/homestay-37.html`) và các trang phân trang (`?page=2`).
   * Vì vậy phải duyệt BFS 2 tầng: danh sách -> danh mục -> bài viết.
   * Dừng sớm khi đã đủ số bài mới cần tìm (`limit`) hoặc hết ngân sách request.
   */
  private async scanListings(limit: number): Promise<{ newUrls: string[]; bySlug: Map<string, string> }> {
    const bySlug = new Map<string, string>();
    const seenPosts = new Set<string>();
    const visited = new Set<string>();
    const queue: string[] = [];

    for (const section of LISTING_SECTIONS) {
      const url = normalizeUrl(`${site.baseUrl}${section}`, site.baseUrl);
      if (url) queue.push(url, withPage(url, 2));
    }

    let budget = MAX_LISTING_FETCHES;
    let failed = 0;

    while (queue.length > 0 && budget > 0) {
      const pageUrl = queue.shift() as string;
      if (visited.has(pageUrl)) continue;
      visited.add(pageUrl);
      budget -= 1;

      let html: string;
      try {
        html = await fetchHtml(pageUrl);
      } catch {
        failed += 1;
        continue;
      }

      const { posts, categories } = extractLinks(html, pageUrl);

      for (const url of posts) {
        const info = describeLegacyUrl(url);
        if (info.legacySlug) bySlug.set(info.legacySlug.toLowerCase(), url);
        seenPosts.add(url);
      }

      for (const category of categories) {
        if (!visited.has(category)) queue.push(category);
      }

      if (seenPosts.size > 0 && budget % 3 === 0) {
        const fresh = await this.filterNew(seenPosts);
        if (fresh.length >= limit) break;
      }
    }

    if (failed > 0) {
      this.logger.warn(`Quét danh sách: ${failed} trang không tải được (bỏ qua)`);
    }

    return { newUrls: await this.filterNew(seenPosts), bySlug };
  }

  /** Lọc các URL chưa có trong database (theo sourceKey). */
  private async filterNew(urls: Set<string>): Promise<string[]> {
    const infos = [...urls].map((url) => describeLegacyUrl(url));
    const existing = await this.findExisting(infos);
    return infos.filter((info) => !(info.sourceKey && existing.has(info.sourceKey))).map((info) => info.url);
  }

  /** Tải toàn bộ ảnh của bài về `/upload`, trả về map URL gốc -> đường dẫn mới. */
  private async downloadImages(
    item: ScrapedItem,
    slug: string,
  ): Promise<{
    byUrl: Map<string, string>;
    images: Prisma.PostImageCreateWithoutPostInput[];
    failures: string[];
  }> {
    const byUrl = new Map<string, string>();
    const failures: string[] = [];
    const collected = new Map<string, { url: string; role: string; alt: string | null }>();

    for (const image of item.images ?? []) {
      const url = normalizeUrl(image.url, site.baseUrl);
      if (!url) continue;
      const current = collected.get(url);
      const role = image.role ?? 'gallery';
      if (!current || (ROLE_ORDER[role] ?? 9) < (ROLE_ORDER[current.role] ?? 9)) {
        collected.set(url, { url, role, alt: image.alt ?? null });
      }
    }

    // Ảnh nằm trong nội dung (nếu parser chưa liệt kê)
    for (const src of extractImageSources(item.contentHtml)) {
      const url = absolutize(src, item.url);
      if (!url) continue;
      if (!collected.has(url)) collected.set(url, { url, role: 'content', alt: null });
    }

    const entries = [...collected.values()];
    const uploaded = await mapLimit(entries, httpConfig.concurrency, async (entry, index) => {
      try {
        const { buffer, contentType } = await fetchBinary(entry.url);
        const mime = normalizeImageMime(contentType, entry.url);
        const result = await this.uploads.save(
          // Tên file: <slug>-<số>.jpg - tránh tên gốc bị URL-encode (%E1%BB%A3...) rất dài
          { buffer, size: buffer.byteLength, mimetype: mime, originalname: `${slug}-${index + 1}.${extensionFor(mime)}` },
          UPLOAD.postsFolder,
        );
        return { entry, path: result.path, bytes: result.bytes };
      } catch (error) {
        failures.push(`${entry.url}: ${error instanceof Error ? error.message : 'lỗi'}`);
        return null;
      }
    });

    const usable = uploaded.filter((item): item is NonNullable<typeof item> => Boolean(item));
    const ordered = [...usable].sort((a, b) => (ROLE_ORDER[a.entry.role] ?? 9) - (ROLE_ORDER[b.entry.role] ?? 9));

    const images: Prisma.PostImageCreateWithoutPostInput[] = ordered.map((entry, index) => {
      byUrl.set(entry.entry.url, entry.path);
      return {
        path: entry.path,
        role: index === 0 ? 'hero' : entry.entry.role,
        alt: entry.entry.alt,
        bytes: entry.bytes,
        sortOrder: index,
      };
    });

    return { byUrl, images, failures };
  }

  /** Tạo/tra tag theo tên (slug hoá giống seed). */
  private async resolveTags(names: string[]): Promise<Array<{ id: string; name: string }>> {
    const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
    const tags: Array<{ id: string; name: string }> = [];

    for (const name of unique.slice(0, 40)) {
      const slug = slugifyTitle(name, 80);
      if (!slug) continue;
      const tag = await this.prisma.tag.upsert({
        where: { slug },
        create: { name, slug },
        update: {},
        select: { id: true, name: true },
      });
      tags.push(tag);
    }

    return tags;
  }
}

// -----------------------------------------------------------------------------
// Hàm thuần (dễ test)
// -----------------------------------------------------------------------------

/**
 * Lấy link bài viết và link danh mục trong HTML của một trang danh sách.
 *
 * - `posts`: URL chi tiết (có dạng `...-<id>.html`, nhận diện bằng `itemTypeOfDetail`)
 * - `categories`: trang danh mục cùng khu vực (ví dụ `/noi-luu-tru/homestay-37.html`)
 */
function extractLinks(html: string, pageUrl: string): { posts: string[]; categories: string[] } {
  const posts = new Set<string>();
  const categories = new Set<string>();

  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const url = absolutize(match[1], pageUrl);
    if (!url) continue;

    const info = describeLegacyUrl(url);
    if (info.itemType && info.sourceId !== null) {
      posts.add(url);
      continue;
    }

    // Trang danh mục: nằm trong prefix cho phép, có hậu tố -<id>.html hoặc là trang gốc khu vực
    if (isAllowedListingPath(url) && !url.includes('?') && url !== pageUrl) {
      const path = info.path === '/' ? '/' : info.path;
      if (/-\d+\.html?$/i.test(path) || LISTING_SECTIONS.includes(path)) categories.add(url);
    }
  }

  return { posts: [...posts], categories: [...categories] };
}

/** Lấy src của tất cả ảnh trong nội dung HTML. */
function extractImageSources(html: string | null | undefined): string[] {
  if (!html) return [];
  return [...html.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
}

/**
 * Viết lại nội dung HTML của bài mới:
 *  - ảnh: đổi sang đường dẫn `/upload/...` (ảnh không tải được thì bỏ thẻ)
 *  - liên kết tới bài/danh mục trên site cũ: đổi sang đường dẫn của website mới
 *  - tag: `/tags/x` -> `/tim-kiem?q=x`
 */
function rewriteContentHtml(
  html: string | null | undefined,
  media: Map<string, string>,
  context: {
    postBySourceKey: Map<string, { slug: string; type: PostType }>;
    categorySlugs: Set<string>;
  },
): string | null {
  if (!html) return null;
  let output = html;

  // (1) Ảnh
  output = output.replace(/<img\b[^>]*>/gi, (tag) => {
    const srcMatch = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (!srcMatch) return '';
    const raw = srcMatch[1].trim();
    const absolute = absolutize(raw, site.baseUrl) ?? raw;
    const mapped = media.get(absolute) ?? media.get(raw);
    if (!mapped) return ''; // ảnh ngoài / tải lỗi -> bỏ, site mới không hotlink
    return tag.replace(srcMatch[0], `src="${mapped}"`);
  });

  // (2) Liên kết
  output = output.replace(/<a\b([^>]*)href\s*=\s*["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi, (match, before, href, after, inner) => {
    const target = mapLink(String(href), context);
    if (target === null) return inner; // bỏ liên kết nhưng giữ nội dung
    return `<a${before}href="${target}"${after}>${inner}</a>`;
  });

  return output;
}

/** Đổi một liên kết của site cũ sang đường dẫn website mới (null = bỏ liên kết). */
function mapLink(
  href: string,
  context: {
    postBySourceKey: Map<string, { slug: string; type: PostType }>;
    categorySlugs: Set<string>;
  },
): string | null {
  const value = href.trim();
  if (!value) return null;
  // Anchor trong trang (#menu1), mailto:, tel:, javascript: -> giữ nguyên như bản gốc
  if (value.startsWith('#') || /^(mailto|tel|javascript):/i.test(value)) return value;

  const isAbsolute = /^https?:\/\//i.test(value);
  const baseHost = new URL(site.baseUrl).hostname;
  let path: string;

  if (isAbsolute) {
    try {
      const parsed = new URL(value);
      if (parsed.hostname.replace(/^www\./, '') !== baseHost) return value; // link ngoài: giữ nguyên
      path = decodeURIComponent(parsed.pathname);
    } catch {
      return value;
    }
  } else if (value.startsWith('/')) {
    path = decodeURIComponent(value);
  } else {
    return value; // link tương đối khác: giữ nguyên
  }

  // Tag -> trang tìm kiếm
  if (path.startsWith('/tags/')) {
    return `/tim-kiem?q=${encodeURIComponent(path.slice('/tags/'.length).replace(/-/g, ' '))}`;
  }

  const info = describeLegacyUrl(`${site.baseUrl}${path}`);
  if (info.itemType && info.sourceId !== null) {
    const post = info.sourceKey ? context.postBySourceKey.get(info.sourceKey) : undefined;
    if (!post) return null; // bài cũ không còn trên web mới
    return postPath(post.type, post.slug);
  }

  // Danh mục / trang chuyên mục
  if (path === '/' || path === '/index.html') return '/';
  const sectionMap: Record<string, string> = {
    '/noi-luu-tru': '/luu-tru',
    '/tin-tuc.html': '/tin-tuc',
    '/tin-tuc': '/tin-tuc',
    '/bat-dong-san.html': '/bat-dong-san',
    '/bat-dong-san': '/bat-dong-san',
  };
  if (sectionMap[path]) return sectionMap[path];

  const segments = path.split('/').filter(Boolean);
  const last = segments[segments.length - 1]?.replace(/\.html?$/i, '') ?? '';
  if (last && context.categorySlugs.has(last)) return `/danh-muc/${last}`;

  // Đường dẫn đã là của website mới
  if (/^\/(luu-tru|tin-tuc|bat-dong-san|trang|danh-muc)\//.test(path)) return path;

  return null;
}

/** Chuẩn hoá content-type của ảnh về loại được phép upload. */
function normalizeImageMime(contentType: string | null, url: string): string {
  const type = (contentType ?? '').split(';')[0].trim().toLowerCase();
  if (type.startsWith('image/')) {
    if (type === 'image/jpg') return 'image/jpeg';
    if ((UPLOAD.allowedMimeTypes as readonly string[]).includes(type)) return type;
  }

  const extension = (url.split('?')[0].match(/\.([a-z0-9]+)$/i)?.[1] ?? '').toLowerCase();
  const byExtension: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    avif: 'image/avif',
  };
  return byExtension[extension] ?? 'image/jpeg';
}

/** Phần mở rộng file theo MIME. */
function extensionFor(mime: string): string {
  return mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
}

/** Slug không trùng: thêm hậu tố -2, -3... */
function uniqueSlug(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

function sortCandidates(candidates: CrawlCandidate[]): CrawlCandidate[] {
  const rank: Record<CrawlCandidateStatus, number> = {
    [CrawlCandidateStatus.NEW]: 0,
    [CrawlCandidateStatus.EXISTING]: 1,
    [CrawlCandidateStatus.ERROR]: 2,
  };
  return [...candidates].sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.trunc(value), min), max);
}

function toInt(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function toFloat(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(number) ? number : null;
}

function toBigInt(value: unknown): bigint | null {
  if (value === null || value === undefined || value === '') return null;
  try {
    return BigInt(String(value).replace(/[^\d]/g, '') || '0');
  } catch {
    return null;
  }
}

function jsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}
