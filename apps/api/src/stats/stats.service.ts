import { Injectable } from '@nestjs/common';
import { PostStatus, PostType } from '@prisma/client';
import { POST_TYPE_LABELS, POST_STATUS_LABELS, type PostStatus as SharedPostStatus, type PostType as SharedPostType } from '@phuochai/shared';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardStatsEntity, PublicStatsEntity } from './entities/stats.entity';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Thống kê cho dashboard quản trị. */
  async dashboard(): Promise<DashboardStatsEntity> {
    const [totalPosts, publishedPosts, draftPosts, archivedPosts, totalUsers, totalCategories, viewAgg, byType, byStatus, byMonth] =
      await Promise.all([
        this.prisma.post.count(),
        this.prisma.post.count({ where: { status: PostStatus.PUBLISHED } }),
        this.prisma.post.count({ where: { status: PostStatus.DRAFT } }),
        this.prisma.post.count({ where: { status: PostStatus.ARCHIVED } }),
        this.prisma.user.count(),
        this.prisma.category.count(),
        this.prisma.post.aggregate({ _sum: { views: true } }),
        this.prisma.post.groupBy({ by: ['type'], _count: { _all: true } }),
        this.prisma.post.groupBy({ by: ['status'], _count: { _all: true } }),
        this.monthlyCounts(),
      ]);

    const typeCountMap = new Map(byType.map((row) => [row.type, row._count._all]));
    const statusCountMap = new Map(byStatus.map((row) => [row.status, row._count._all]));

    return {
      totalPosts,
      publishedPosts,
      draftPosts,
      archivedPosts,
      totalUsers,
      totalCategories,
      totalViews: viewAgg._sum.views ?? 0,
      postsByType: Object.values(PostType).map((type) => ({
        value: type,
        label: POST_TYPE_LABELS[type as SharedPostType] ?? type,
        count: typeCountMap.get(type) ?? 0,
      })),
      postsByStatus: Object.values(PostStatus).map((status) => ({
        value: status,
        label: POST_STATUS_LABELS[status as SharedPostStatus] ?? status,
        count: statusCountMap.get(status) ?? 0,
      })),
      postsByMonth: byMonth,
    };
  }

  /** Thống kê công khai cho trang chủ. */
  async publicStats(): Promise<PublicStatsEntity> {
    const [accommodations, news, realEstates, categories, cities, totalPosts] = await Promise.all([
      this.prisma.post.count({ where: { status: PostStatus.PUBLISHED, type: PostType.ACCOMMODATION } }),
      this.prisma.post.count({ where: { status: PostStatus.PUBLISHED, type: PostType.NEWS } }),
      this.prisma.post.count({ where: { status: PostStatus.PUBLISHED, type: PostType.REAL_ESTATE } }),
      this.prisma.category.count({ where: { isLocationFilter: false } }),
      this.prisma.post
        .findMany({
          where: { status: PostStatus.PUBLISHED, city: { not: null } },
          select: { city: true },
          distinct: ['city'],
        })
        .then((rows) => rows.length),
      this.prisma.post.count({ where: { status: PostStatus.PUBLISHED } }),
    ]);

    return { accommodations, news, realEstates, categories, cities, totalPosts };
  }

  private async monthlyCounts(): Promise<{ month: string; count: number }[]> {
    const rows = await this.prisma.$queryRawUnsafe<{ month: string; count: bigint }[]>(`
      SELECT to_char(date_trunc('month', COALESCE("publishedAt", "createdAt")), 'YYYY-MM') AS month,
             COUNT(*)::bigint AS count
      FROM posts
      WHERE COALESCE("publishedAt", "createdAt") >= (now() - interval '6 months')
      GROUP BY 1
      ORDER BY 1 ASC
    `);
    return rows.map((row) => ({ month: row.month, count: Number(row.count) }));
  }
}
