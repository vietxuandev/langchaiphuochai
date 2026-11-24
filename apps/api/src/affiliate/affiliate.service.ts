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
    const where: Prisma.AffiliateLinkWhereInput = {
      ...(typeof options.active === 'boolean' ? { isActive: options.active } : {}),
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
