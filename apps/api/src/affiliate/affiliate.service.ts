import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AffiliateLinkInput {
  slug?: string;
  title?: string;
  description?: string | null;
  merchant?: string;
  destinationUrl?: string;
  imagePath?: string | null;
  priceText?: string | null;
  campaign?: string | null;
  subId?: string | null;
  isActive?: boolean;
}

export interface AffiliateListOptions {
  query?: string;
  campaign?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SUB_ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

function clean(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

/** Chỉ cho phép link Shopee chính thức để tránh open redirect. */
function validateDestination(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new BadRequestException('URL đích không hợp lệ');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new BadRequestException('URL đích phải là http hoặc https');
  }
  if (url.username || url.password) {
    throw new BadRequestException('URL đích không được chứa thông tin đăng nhập');
  }
  const host = url.hostname.toLowerCase();
  const allowed =
    host === 'shopee.vn' ||
    host.endsWith('.shopee.vn') ||
    host === 'shope.ee' ||
    host.endsWith('.shope.ee');
  if (!allowed) {
    throw new BadRequestException('Chỉ chấp nhận link thuộc shopee.vn hoặc shope.ee');
  }
  return url.toString();
}

function validateSlug(input: string): string {
  const slug = input.trim().toLowerCase();
  if (!SLUG_RE.test(slug) || slug.length < 3 || slug.length > 80) {
    throw new BadRequestException('Slug phải 3-80 ký tự, chỉ gồm chữ thường, số và dấu gạch nối');
  }
  return slug;
}


function extractShopeeIds(rawUrl: string): { itemId: string | null; shopId: string | null } {
  try {
    const path = new URL(rawUrl).pathname;
    const matches = [...path.matchAll(/\/(\d{5,})(?=\/|$)/g)].map((match) => match[1]);
    if (matches.length >= 2) {
      return { shopId: matches[matches.length - 2], itemId: matches[matches.length - 1] };
    }
    if (matches.length === 1) return { shopId: null, itemId: matches[0] };
    return { itemId: null, shopId: null };
  } catch {
    return { itemId: null, shopId: null };
  }
}

function metaContent(html: string, key: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function extractOpenGraph(html: string): {
  title: string | null;
  description: string | null;
  image: string | null;
  price: string | null;
} {
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null;
  return {
    title: metaContent(html, 'og:title') ?? (titleTag ? titleTag.replace(/\s+/g, ' ') : null),
    description: metaContent(html, 'og:description') ?? metaContent(html, 'description'),
    image: metaContent(html, 'og:image') ?? metaContent(html, 'twitter:image'),
    price: metaContent(html, 'product:price:amount') ?? metaContent(html, 'og:price:amount'),
  };
}

function localDateKey(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  const salt = process.env.AFFILIATE_HASH_SALT ?? process.env.JWT_SECRET ?? 'affiliate-local';
  return createHash('sha256').update(`${ip}:${salt}`).digest('hex').slice(0, 32);
}

@Injectable()
export class AffiliateService {
  constructor(private readonly prisma: PrismaService) {}

  async list(options: AffiliateListOptions = {}) {
    const page = Math.max(1, Math.floor(options.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Math.floor(options.pageSize ?? 20)));
    const query = options.query?.trim();
    const campaign = options.campaign?.trim();
    const where: Prisma.AffiliateLinkWhereInput = {
      ...(typeof options.active === 'boolean' ? { isActive: options.active } : {}),
      ...(campaign
        ? { campaign: { equals: campaign, mode: 'insensitive' as const } }
        : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: 'insensitive' as const } },
              { slug: { contains: query, mode: 'insensitive' as const } },
              { campaign: { contains: query, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.affiliateLink.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.affiliateLink.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }

  async get(id: string) {
    const link = await this.prisma.affiliateLink.findUnique({ where: { id } });
    if (!link) throw new NotFoundException('Không tìm thấy link affiliate');
    return link;
  }

  async create(input: AffiliateLinkInput) {
    const title = input.title?.trim();
    const destinationUrl = input.destinationUrl?.trim();
    if (!title || title.length < 3) throw new BadRequestException('Tiêu đề phải có ít nhất 3 ký tự');
    if (!destinationUrl) throw new BadRequestException('Thiếu URL đích');

    const slug = validateSlug(input.slug ?? '');
    const data: Prisma.AffiliateLinkCreateInput = {
      slug,
      title: title.slice(0, 200),
      description: clean(input.description),
      merchant: (input.merchant?.trim() || 'SHOPEE').toUpperCase().slice(0, 30),
      destinationUrl: validateDestination(destinationUrl),
      imagePath: this.validateImagePath(input.imagePath),
      priceText: clean(input.priceText)?.slice(0, 80),
      campaign: clean(input.campaign)?.slice(0, 80),
      subId: this.validateSubId(input.subId),
      isActive: input.isActive ?? true,
    };

    try {
      return await this.prisma.affiliateLink.create({ data });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('Slug đã tồn tại, hãy chọn slug khác');
      }
      throw error;
    }
  }

  async update(id: string, input: AffiliateLinkInput) {
    const current = await this.get(id);
    const data: Prisma.AffiliateLinkUpdateInput = {};

    if (input.title !== undefined) {
      const title = input.title.trim();
      if (title.length < 3) throw new BadRequestException('Tiêu đề phải có ít nhất 3 ký tự');
      data.title = title.slice(0, 200);
    }
    if (input.slug !== undefined) data.slug = validateSlug(input.slug);
    if (input.destinationUrl !== undefined) data.destinationUrl = validateDestination(input.destinationUrl);
    if (input.description !== undefined) data.description = clean(input.description);
    if (input.merchant !== undefined) data.merchant = (input.merchant.trim() || 'SHOPEE').toUpperCase().slice(0, 30);
    if (input.imagePath !== undefined) data.imagePath = this.validateImagePath(input.imagePath);
    if (input.priceText !== undefined) data.priceText = clean(input.priceText)?.slice(0, 80);
    if (input.campaign !== undefined) data.campaign = clean(input.campaign)?.slice(0, 80);
    if (input.subId !== undefined) data.subId = this.validateSubId(input.subId);
    if (input.isActive !== undefined) data.isActive = input.isActive;

    try {
      return await this.prisma.affiliateLink.update({ where: { id: current.id }, data });
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException('Slug đã tồn tại, hãy chọn slug khác');
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.get(id);
    await this.prisma.affiliateLink.delete({ where: { id } });
    return { ok: true };
  }

  /** API công khai cho shortcode thẻ sản phẩm; không trả URL đích. */
  async publicCard(slug: string) {
    const link = await this.prisma.affiliateLink.findFirst({
      where: { slug, isActive: true },
      select: {
        slug: true,
        title: true,
        description: true,
        merchant: true,
        imagePath: true,
        priceText: true,
      },
    });
    if (!link) throw new NotFoundException('Không tìm thấy link affiliate');
    return link;
  }

  /**
   * Lấy metadata sản phẩm từ link affiliate.
   *
   * - Luôn resolve redirect của Shopee để lấy item_id/shop_id.
   * - Thử đọc OG tags nếu Shopee trả HTML có metadata.
   * - Nếu có SHOPEE_AFFILIATE_ACCESS_TOKEN, gọi Open API product_item_get.
   * - Shopee chặn bot ở nhiều thời điểm nên luôn trả thông tin một phần để admin nhập tay.
   */
  async fetchMetadata(inputUrl: string) {
    const initial = validateDestination(inputUrl);
    const { finalUrl, html } = await this.resolveFinalPage(initial);
    const ids = extractShopeeIds(finalUrl);
    const meta = extractOpenGraph(html);

    if (meta.title || meta.image) {
      return {
        ok: true,
        source: 'html' as const,
        finalUrl,
        itemId: ids.itemId,
        shopId: ids.shopId,
        title: meta.title,
        description: meta.description,
        imagePath: meta.image,
        priceText: meta.price,
      };
    }

    const token = process.env.SHOPEE_AFFILIATE_ACCESS_TOKEN?.trim();
    if (!token) {
      return {
        ok: false,
        code: 'MISSING_TOKEN',
        finalUrl,
        itemId: ids.itemId,
        shopId: ids.shopId,
        message:
          'Shopee không trả metadata HTML cho link này. Cần cấu hình SHOPEE_AFFILIATE_ACCESS_TOKEN để dùng Open API, hoặc nhập tay.',
      };
    }

    if (!ids.itemId) {
      return {
        ok: false,
        code: 'MISSING_ITEM_ID',
        finalUrl,
        itemId: null,
        shopId: ids.shopId,
        message: 'Không tách được item_id từ link Shopee.',
      };
    }

    try {
      const params = new URLSearchParams({ item_id: ids.itemId });
      if (ids.shopId) params.set('shop_id', ids.shopId);
      const response = await fetch(`https://open.shopee.vn/openapi/product/v2/product_item_get?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      const payload = (await response.json()) as {
        data?: {
          title?: string;
          description?: string;
          images?: string[];
          price?: number;
        };
        message?: string;
      };

      if (!response.ok || !payload.data) {
        return {
          ok: false,
          code: 'SHOPEE_API_ERROR',
          finalUrl,
          itemId: ids.itemId,
          shopId: ids.shopId,
          message: payload.message ?? `Open API trả HTTP ${response.status}`,
        };
      }

      const data = payload.data;
      return {
        ok: true,
        source: 'openapi' as const,
        finalUrl,
        itemId: ids.itemId,
        shopId: ids.shopId,
        title: data.title ?? null,
        description: data.description ?? null,
        imagePath: data.images?.[0] ?? null,
        priceText: typeof data.price === 'number' ? `${new Intl.NumberFormat('vi-VN').format(data.price)}đ` : null,
      };
    } catch (error) {
      return {
        ok: false,
        code: 'SHOPEE_API_ERROR',
        finalUrl,
        itemId: ids.itemId,
        shopId: ids.shopId,
        message: error instanceof Error ? error.message : 'Không gọi được Shopee Open API',
      };
    }
  }

  /** Resolve redirect thủ công, chỉ theo domain Shopee, trả HTML cuối cùng. */
  private async resolveFinalPage(initialUrl: string): Promise<{ finalUrl: string; html: string }> {
    let current = initialUrl;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(current, {
        redirect: 'manual',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) break;
        const next = new URL(location, current).toString();
        current = validateDestination(next);
        continue;
      }

      return { finalUrl: response.url || current, html: await response.text() };
    }

    return { finalUrl: current, html: '' };
  }

  async stats() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const [totalLinks, activeLinks, totalClicks, clicksToday, clicks7d, topLinks, recentClicks, noClicks, inactive, missingImage, weekClicks] =
      await Promise.all([
        this.prisma.affiliateLink.count(),
        this.prisma.affiliateLink.count({ where: { isActive: true } }),
        this.prisma.affiliateLink.aggregate({ _sum: { clicks: true } }),
        this.prisma.affiliateClick.count({ where: { createdAt: { gte: startOfDay } } }),
        this.prisma.affiliateClick.count({ where: { createdAt: { gte: startOfWeek } } }),
        this.prisma.affiliateLink.findMany({
          where: { isActive: true },
          orderBy: [{ clicks: 'desc' }, { updatedAt: 'desc' }],
          take: 5,
          select: { id: true, slug: true, title: true, clicks: true },
        }),
        this.prisma.affiliateClick.findMany({
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: { link: { select: { slug: true, title: true } } },
        }),
        this.prisma.affiliateLink.count({ where: { clicks: 0 } }),
        this.prisma.affiliateLink.count({ where: { isActive: false } }),
        this.prisma.affiliateLink.count({ where: { OR: [{ imagePath: null }, { imagePath: '' }] } }),
        this.prisma.affiliateClick.findMany({
          where: { createdAt: { gte: startOfWeek } },
          select: { createdAt: true },
        }),
      ]);

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(startOfDay);
      date.setDate(date.getDate() - (6 - index));
      return { date: localDateKey(date), count: 0 };
    });
    for (const click of weekClicks) {
      const key = localDateKey(click.createdAt);
      const day = days.find((item) => item.date === key);
      if (day) day.count += 1;
    }

    return {
      totalLinks,
      activeLinks,
      inactiveLinks: inactive,
      totalClicks: totalClicks._sum.clicks ?? 0,
      clicksToday,
      clicks7d,
      noClickLinks: noClicks,
      missingImageLinks: missingImage,
      health: { inactive, noClicks, missingImage },
      topLinks,
      recentClicks,
      clickTrend: days,
    };
  }

  /** Resolve link, ghi click và trả URL Shopee kèm sub_id. */
  async resolve(slug: string, context: { from?: string; referrer?: string; ip?: string; userAgent?: string }) {
    const link = await this.prisma.affiliateLink.findUnique({ where: { slug } });
    if (!link || !link.isActive) throw new NotFoundException('Link affiliate không tồn tại hoặc đã tắt');

    const url = new URL(validateDestination(link.destinationUrl));
    const from = context.from?.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60);
    const base = link.subId?.trim() || `ph_${link.slug}`;
    const subId = `${base}${from ? `_${from}` : ''}`.slice(0, 100);
    url.searchParams.set('sub_id', subId);

    await this.prisma.$transaction([
      this.prisma.affiliateLink.update({
        where: { id: link.id },
        data: { clicks: { increment: 1 }, lastClickedAt: new Date() },
      }),
      this.prisma.affiliateClick.create({
        data: {
          linkId: link.id,
          postSlug: from || null,
          referrer: context.referrer?.slice(0, 500) || null,
          ipHash: hashIp(context.ip),
          userAgent: context.userAgent?.slice(0, 300) || null,
        },
      }),
    ]);

    return url.toString();
  }

  private validateImagePath(value: string | null | undefined): string | null {
    const path = clean(value);
    if (!path) return null;
    if (path.startsWith('/upload/')) return path;
    if (path.startsWith('https://') || path.startsWith('http://')) return path;
    throw new BadRequestException('Ảnh phải là đường dẫn /upload/... hoặc URL http(s)');
  }

  private validateSubId(value: string | null | undefined): string | null {
    const subId = clean(value);
    if (!subId) return null;
    if (!SUB_ID_RE.test(subId)) {
      throw new BadRequestException('sub_id chỉ gồm chữ, số, gạch nối, gạch dưới (tối đa 80 ký tự)');
    }
    return subId;
  }
}
