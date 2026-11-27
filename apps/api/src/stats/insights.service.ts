import { Injectable } from '@nestjs/common';
import { PostStatus, PostType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  DashboardInsightsEntity,
  DayCountEntity,
  InsightIssueEntity,
  InsightItemEntity,
} from './entities/insights.entity';

const MIN_WORDS = 250;
const SAMPLE_SIZE = 5;
const STALE_DRAFT_DAYS = 30;
const CACHE_MS = 60_000;

function countWords(html: string | null): number {
  if (!html) return 0;
  const text = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');
  return text.split(/\s+/).filter(Boolean).length;
}

function issue(key: string, label: string, all: InsightItemEntity[]): InsightIssueEntity {
  return { key, label, count: all.length, items: all.slice(0, SAMPLE_SIZE) };
}

@Injectable()
export class InsightsService {
  private cache: { at: number; value: DashboardInsightsEntity } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async dashboard(): Promise<DashboardInsightsEntity> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.value;
    const [health, attention, views, affiliate, activity, byMonthType] = await Promise.all([
      this.contentHealth(),
      this.attention(),
      this.views(),
      this.affiliate(),
      this.activity(),
      this.monthByType(),
    ]);
    const value: DashboardInsightsEntity = {
      publishedChecked: health.checked,
      contentHealth: health.issues,
      attention,
      views,
      affiliate,
      activity,
      postsByMonthType: byMonthType,
    };
    this.cache = { at: Date.now(), value };
    return value;
  }

  private async contentHealth(): Promise<{ checked: number; issues: InsightIssueEntity[] }> {
    const posts = await this.prisma.post.findMany({
      where: { status: PostStatus.PUBLISHED, type: { not: PostType.PAGE } },
      select: {
        id: true,
        title: true,
        type: true,
        summary: true,
        seoTitle: true,
        contentHtml: true,
        _count: { select: { images: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const thin: InsightItemEntity[] = [];
    const noHero: InsightItemEntity[] = [];
    const noToc: InsightItemEntity[] = [];
    const h2Mismatch: InsightItemEntity[] = [];
    const noSummary: InsightItemEntity[] = [];
    const noSeoTitle: InsightItemEntity[] = [];

    for (const post of posts) {
      const html = post.contentHtml ?? '';
      const base = { id: post.id, title: post.title };
      const words = countWords(html);
      if (words < MIN_WORDS) thin.push({ ...base, detail: `${words} từ` });
      if (post._count.images === 0) noHero.push(base);
      if (!post.summary?.trim()) noSummary.push(base);
      if (!post.seoTitle?.trim()) noSeoTitle.push(base);
      if (post.type === PostType.NEWS && words >= MIN_WORDS) {
        if (!/id=["']main-toc["']/.test(html)) noToc.push(base);
        const h2Total = (html.match(/<h2\b/gi) ?? []).length;
        const h2WithId = (html.match(/<h2\b[^>]*\sid=["'][^"']+["']/gi) ?? []).length;
        if (h2Total !== h2WithId) h2Mismatch.push({ ...base, detail: `${h2WithId}/${h2Total} H2 có id` });
      }
    }

    return {
      checked: posts.length,
      issues: [
        issue('thin', `Nội dung dưới ${MIN_WORDS} từ (đang noindex)`, thin),
        issue('noHero', 'Chưa có ảnh bìa', noHero),
        issue('noToc', 'Bài tin tức thiếu mục lục', noToc),
        issue('h2Mismatch', 'H2 thiếu id (lệch mục lục)', h2Mismatch),
        issue('noSummary', 'Thiếu tóm tắt', noSummary),
        issue('noSeoTitle', 'Thiếu tiêu đề SEO', noSeoTitle),
      ],
    };
  }

  private async attention(): Promise<InsightIssueEntity[]> {
    const staleBefore = new Date(Date.now() - STALE_DRAFT_DAYS * 86_400_000);
    const [staleDrafts, duplicates, inactiveLinks] = await Promise.all([
      this.prisma.post.findMany({
        where: { status: PostStatus.DRAFT, updatedAt: { lt: staleBefore } },
        select: { id: true, title: true, updatedAt: true },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.$queryRaw<{ id: string; title: string; dup: bigint }[]>`
        SELECT p.id, p.title, d.n AS dup
        FROM posts p
        JOIN (
          SELECT lower(trim(title)) AS t, COUNT(*) AS n
          FROM posts WHERE status <> 'ARCHIVED' AND type <> 'PAGE'
          GROUP BY 1 HAVING COUNT(*) > 1
        ) d ON lower(trim(p.title)) = d.t
        WHERE p.status <> 'ARCHIVED'
        ORDER BY p.title, p."createdAt"`,
      this.prisma.affiliateLink.findMany({
        where: { isActive: false },
        select: { id: true, title: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return [
      issue(
        'staleDrafts',
        `Bản nháp quá ${STALE_DRAFT_DAYS} ngày chưa cập nhật`,
        staleDrafts.map((post) => ({
          id: post.id,
          title: post.title,
          detail: `${Math.floor((Date.now() - post.updatedAt.getTime()) / 86_400_000)} ngày`,
        })),
      ),
      issue(
        'duplicateTitles',
        'Bài trùng tiêu đề (dễ bị coi là nội dung lặp)',
        duplicates.map((row) => ({ id: row.id, title: row.title, detail: `${Number(row.dup)} bài trùng` })),
      ),
      issue(
        'inactiveAffiliate',
        'Link affiliate đang tắt/hỏng',
        inactiveLinks.map((link) => ({ id: link.id, title: link.title })),
      ),
    ];
  }

  private async fillDays(
    rows: { day: string; count: bigint | number }[],
    days: number,
  ): Promise<DayCountEntity[]> {
    const map = new Map(rows.map((row) => [row.day, Number(row.count)]));
    const result: DayCountEntity[] = [];
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const date = new Date(Date.now() + 7 * 3_600_000 - offset * 86_400_000);
      const key = date.toISOString().slice(0, 10);
      result.push({ day: key, count: map.get(key) ?? 0 });
    }
    return result;
  }

  private async views(): Promise<DashboardInsightsEntity['views']> {
    const [dayRows, topRows, first] = await Promise.all([
      this.prisma.$queryRaw<{ day: string; count: bigint }[]>`
        SELECT to_char(day, 'YYYY-MM-DD') AS day, SUM(views)::bigint AS count
        FROM post_view_daily
        WHERE day >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 29
        GROUP BY 1`,
      this.prisma.$queryRaw<
        { id: string; title: string; slug: string; type: string; views: number; views30d: bigint }[]
      >`
        SELECT p.id, p.title, p.slug, p.type::text AS type, p.views,
               COALESCE(SUM(v.views) FILTER (
                 WHERE v.day >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 29), 0)::bigint AS "views30d"
        FROM posts p
        LEFT JOIN post_view_daily v ON v."postId" = p.id
        WHERE p.status = 'PUBLISHED'
        GROUP BY p.id
        ORDER BY p.views DESC
        LIMIT 10`,
      this.prisma.$queryRaw<{ day: string | null }[]>`
        SELECT to_char(MIN(day), 'YYYY-MM-DD') AS day FROM post_view_daily`,
    ]);

    const byDay = await this.fillDays(dayRows, 30);
    return {
      last7: byDay.slice(-7).reduce((sum, item) => sum + item.count, 0),
      last30: byDay.reduce((sum, item) => sum + item.count, 0),
      trackedSince: first[0]?.day ?? null,
      byDay,
      topPosts: topRows.map((row) => ({ ...row, views30d: Number(row.views30d) })),
    };
  }

  private async affiliate(): Promise<DashboardInsightsEntity['affiliate']> {
    const [totalLinks, activeLinks, clickAgg, dayRows, topRows] = await Promise.all([
      this.prisma.affiliateLink.count(),
      this.prisma.affiliateLink.count({ where: { isActive: true } }),
      this.prisma.affiliateLink.aggregate({ _sum: { clicks: true } }),
      this.prisma.$queryRaw<{ day: string; count: bigint }[]>`
        SELECT to_char(("createdAt" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD') AS day, COUNT(*)::bigint AS count
        FROM affiliate_clicks
        WHERE "createdAt" >= now() - interval '31 days'
        GROUP BY 1`,
      this.prisma.$queryRaw<
        { id: string; title: string; slug: string; clicks: number; isActive: boolean; clicks30d: bigint }[]
      >`
        SELECT l.id, l.title, l.slug, l.clicks, l."isActive",
               COUNT(c.id) FILTER (WHERE c."createdAt" >= now() - interval '30 days')::bigint AS "clicks30d"
        FROM affiliate_links l
        LEFT JOIN affiliate_clicks c ON c."linkId" = l.id
        GROUP BY l.id
        ORDER BY l.clicks DESC
        LIMIT 5`,
    ]);
    const byDay = await this.fillDays(dayRows, 30);
    return {
      totalLinks,
      activeLinks,
      totalClicks: clickAgg._sum.clicks ?? 0,
      clicks7: byDay.slice(-7).reduce((sum, item) => sum + item.count, 0),
      clicks30: byDay.reduce((sum, item) => sum + item.count, 0),
      byDay,
      topLinks: topRows.map((row) => ({ ...row, clicks30d: Number(row.clicks30d) })),
    };
  }

  private async activity(): Promise<DashboardInsightsEntity['activity']> {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const [recent, calls, errors, lastImport] = await Promise.all([
      this.prisma.mcpAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, tool: true, status: true, postId: true, durationMs: true, createdAt: true },
      }),
      this.prisma.mcpAuditLog.count({ where: { createdAt: { gte: since } } }),
      this.prisma.mcpAuditLog.count({ where: { createdAt: { gte: since }, status: { not: 'ok' } } }),
      this.prisma.importRun.findFirst({ orderBy: { startedAt: 'desc' } }),
    ]);
    return { recentMcp: recent, mcpCalls7d: calls, mcpErrors7d: errors, lastImport };
  }

  private async monthByType(): Promise<DashboardInsightsEntity['postsByMonthType']> {
    const rows = await this.prisma.$queryRaw<{ month: string; type: string; count: bigint }[]>`
      SELECT to_char(date_trunc('month', COALESCE("publishedAt", "createdAt")), 'YYYY-MM') AS month,
             type::text AS type, COUNT(*)::bigint AS count
      FROM posts
      WHERE type <> 'PAGE' AND COALESCE("publishedAt", "createdAt") >= (now() - interval '6 months')
      GROUP BY 1, 2
      ORDER BY 1`;
    return rows.map((row) => ({ ...row, count: Number(row.count) }));
  }
}
