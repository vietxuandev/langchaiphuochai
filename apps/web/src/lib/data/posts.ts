import { notFound } from 'next/navigation';
import { safeQuery } from '@/lib/apollo/rsc-client';
import {
  PostDetailDocument,
  PostWardsDocument,
  PostsDocument,
  RelatedPostsDocument,
  type PostDetailQuery,
  type PostWardsQuery,
  type PostFilterInput,
  type PostType,
  type PostsQuery,
  type RelatedPostsQuery,
} from '@/generated/graphql';

/** Chi tiết bài viết theo slug (dùng trong React Server Component). */
export async function getPostBySlug(slug: string, countView = false) {
  const data = await safeQuery<PostDetailQuery, { slug: string; countView: boolean }>(
    PostDetailDocument,
    { slug, countView },
    { post: null } as unknown as PostDetailQuery,
  );
  return data.post ?? null;
}

/** Chi tiết bài viết, ném 404 nếu không tồn tại. */
export async function getPostBySlugOrNotFound(slug: string, countView = false) {
  const post = await getPostBySlug(slug, countView);
  if (!post) notFound();
  return post;
}

/** Bài viết liên quan. */
export async function getRelatedPosts(slug: string, limit = 4) {
  const data = await safeQuery<RelatedPostsQuery, { slug: string; limit: number }>(
    RelatedPostsDocument,
    { slug, limit },
    { relatedPosts: [] } as unknown as RelatedPostsQuery,
  );
  return data.relatedPosts ?? [];
}

/** Danh sách bài viết (dùng cho SSR các trang danh sách và trang chủ). */
export async function getPosts(filter: PostFilterInput) {
  const data = await safeQuery<PostsQuery, { filter: PostFilterInput }>(
    PostsDocument,
    { filter },
    {
      posts: {
        items: [],
        total: 0,
        page: 1,
        pageSize: filter.pageSize ?? 12,
        totalPages: 1,
        hasNextPage: false,
      },
    } as unknown as PostsQuery,
  );
  return data.posts;
}

/** Danh sách tỉnh/thành có dữ liệu (cho bộ lọc). */

/** Số bài theo xã/phường (chỉ các xã/phường đang có bài) - dùng cho bộ lọc. */
export async function getPostWards(type?: PostType) {
  const data = await safeQuery<PostWardsQuery, { type?: PostType }>(
    PostWardsDocument,
    { type },
    { postWards: [] } as unknown as PostWardsQuery,
  );
  return data.postWards ?? [];
}
