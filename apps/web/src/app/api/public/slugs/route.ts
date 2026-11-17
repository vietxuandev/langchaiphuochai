import { NextResponse } from 'next/server';
import { getNavCategories } from '@/lib/data/categories';
import { getAllPublishedSlugs } from '@/lib/data/posts';

export const dynamic = 'force-dynamic';

interface SlugIndex {
  types: Record<string, string[]>;
  categories: string[];
  updatedAt: string;
}

let cache: { at: number; data: SlugIndex } | null = null;
const TTL_MS = 60_000;
/** Khoảng tối thiểu giữa 2 lần dựng index "tươi" (`?fresh=1`) - chặn bị gọi dồn dập. */
const FRESH_INTERVAL_MS = 10_000;
let lastFreshAt = 0;

const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' };

/**
 * Slug index cho middleware.
 *
 * Chỉ trả slug đã publish; middleware dùng danh sách này để trả 404 sớm,
 * tránh sinh cache ISR cho slug rác.
 *
 * `?fresh=1`: bỏ qua cache (middleware gọi khi gặp slug chưa có trong index - thường là bài
 * vừa xuất bản), tối đa 1 lần mỗi FRESH_INTERVAL_MS.
 */
export async function GET(request: Request) {
  const wantsFresh = new URL(request.url).searchParams.get('fresh') === '1';
  const fresh = wantsFresh && Date.now() - lastFreshAt >= FRESH_INTERVAL_MS;

  if (!fresh && cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.data, { headers: CACHE_HEADERS });
  }
  if (fresh) lastFreshAt = Date.now();

  const [posts, categories] = await Promise.all([
    getAllPublishedSlugs({ fresh }),
    getNavCategories({ cache: !fresh }),
  ]);
  const types: Record<string, string[]> = {};
  for (const post of posts) {
    (types[post.type] ??= []).push(post.slug);
  }

  const data: SlugIndex = {
    types,
    categories: categories.map((category) => category.slug),
    updatedAt: new Date().toISOString(),
  };

  // Không cache kết quả rỗng: API có thể đang tạm lỗi.
  if (posts.length > 0) cache = { at: Date.now(), data };

  return NextResponse.json(data, { headers: fresh ? { 'Cache-Control': 'no-store' } : CACHE_HEADERS });
}
