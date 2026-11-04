import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/seo/json-ld';
import { PostDetail } from '@/components/site/post-detail';
import { getPostBySlug, getRelatedPosts } from '@/lib/data/posts';
import { postJsonLd } from '@/lib/seo/structured-data';

export const metadata: Metadata = {
  title: 'Giới thiệu',
  description: 'Giới thiệu về danh bạ lưu trú và thông tin du lịch Phước Hải.',
  alternates: { canonical: '/gioi-thieu' },
};

/** Trang giới thiệu - lấy từ dữ liệu trang tĩnh đã crawl (gioi-thieu). */
export default async function AboutPage() {
  const post = await getPostBySlug('gioi-thieu');
  if (!post) notFound();
  const related = await getRelatedPosts(post.slug, 3);
  return (
    <>
      <JsonLd id="jsonld-post" data={postJsonLd(post, '/gioi-thieu')} />
      <PostDetail post={post} related={related} />
    </>
  );
}
