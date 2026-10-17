import { safeQuery } from '@/lib/apollo/rsc-client';
import { PublicStatsDocument, type PublicStatsQuery } from '@/generated/graphql';

export { getPosts } from './posts';

/** Thống kê công khai cho trang chủ. */
export async function getPublicStats() {
  const data = await safeQuery<PublicStatsQuery, Record<string, never>>(
    PublicStatsDocument,
    {},
    {
      publicStats: { accommodations: 0, news: 0, realEstates: 0, categories: 0, cities: 0, totalPosts: 0 },
    } as unknown as PublicStatsQuery,
  );
  return data.publicStats;
}
