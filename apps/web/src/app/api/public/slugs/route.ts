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

/**
 * Slug index cho middleware.
 *
 * Chỉ trả slug đã publish; middleware dùng danh sách này để trả 404 sớm,
 * tránh sinh cache ISR cho slug rác.
 */
export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
    });
  }

  const [posts, categories] = await Promise.all([getAllPublishedSlugs(), getNavCategories()]);
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

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
