import type { MetadataRoute } from 'next';
import { BRAND } from '@phuochai/shared';
import { postHref } from '@/components/site/post-card';
import { getNavCategories } from '@/lib/data/categories';
import { getPosts } from '@/lib/data/posts';
import type { PostFilterInput } from '@/generated/graphql';

/**
 * sitemap.xml (Next tự phục vụ tại `/sitemap.xml`).
 *
 * Nội dung: trang tĩnh + toàn bộ danh mục + toàn bộ bài viết đã xuất bản.
 *
 * Lưu ý: phải `force-dynamic` vì sitemap lấy dữ liệu từ API. Nếu để Next render
 * tĩnh lúc build thì lúc build trên server (Docker/Coolify) API chưa chạy -> sitemap
 * sẽ rỗng và bị cache vĩnh viễn. Dữ liệu được cache 10 phút trong bộ nhớ để không
 * truy vấn lại cho mỗi lần crawler ghé.
 */
export const dynamic = 'force-dynamic';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? BRAND.siteUrl).replace(/\/$/, '');
const PAGE_SIZE = 100;
const MAX_PAGES = 60;
const CACHE_TTL_MS = 10 * 60 * 1000;

type SitemapEntry = MetadataRoute.Sitemap[number];

/** Trang tĩnh cố định của website. */
const STATIC_ROUTES: SitemapEntry[] = [
  { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
  { url: `${SITE_URL}/luu-tru`, changeFrequency: 'daily', priority: 0.9 },
  { url: `${SITE_URL}/tin-tuc`, changeFrequency: 'daily', priority: 0.9 },
  { url: `${SITE_URL}/bat-dong-san`, changeFrequency: 'daily', priority: 0.8 },
  { url: `${SITE_URL}/gioi-thieu`, changeFrequency: 'monthly', priority: 0.4 },
];

let cache: { at: number; entries: SitemapEntry[] } | null = null;

/** Lấy toàn bộ bài viết đã xuất bản (phân trang theo giới hạn pageSize của API). */
async function loadPublishedPosts() {
  const posts: Awaited<ReturnType<typeof getPosts>>['items'] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const filter = {
      status: 'PUBLISHED',
      page,
      pageSize: PAGE_SIZE,
      sortBy: 'PUBLISHED_AT',
      sortOrder: 'DESC',
    } as PostFilterInput;

    const result = await getPosts(filter);
    posts.push(...result.items);

    if (!result.hasNextPage || result.items.length === 0) break;
  }

  return posts;
}

async function buildEntries(): Promise<SitemapEntry[]> {
  const [categories, posts] = await Promise.all([getNavCategories(), loadPublishedPosts()]);

  const categoryEntries: SitemapEntry[] = categories.map((category) => ({
    url: `${SITE_URL}/danh-muc/${category.slug}`,
    lastModified: category.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const postEntries: SitemapEntry[] = posts
    // Bỏ bài trùng slug (nếu dữ liệu có) để sitemap không lặp URL
    .filter((post, index, all) => all.findIndex((item) => item.slug === post.slug) === index)
    .map((post) => ({
      url: `${SITE_URL}${postHref(post)}`,
      lastModified: post.updatedAt ?? post.publishedAt ?? undefined,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));

  return [...STATIC_ROUTES, ...categoryEntries, ...postEntries];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.entries;
  }

  const entries = await buildEntries();
  // Không cache kết quả rỗng (API lỗi tạm thời) để lần sau crawler vẫn lấy được dữ liệu
  if (entries.length > STATIC_ROUTES.length) {
    cache = { at: Date.now(), entries };
  }

  return entries;
}
