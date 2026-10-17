import type { Metadata } from 'next';
import { PostDetail } from '@/components/site/post-detail';
import { getPostBySlugOrNotFound, getRelatedPosts } from '@/lib/data/posts';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlugOrNotFound(slug);
  return {
    title: post.seoTitle ?? post.title,
    description: post.summary ?? undefined,
    alternates: { canonical: `/trang/${post.slug}` },
  };
}

/** Trang thông tin tĩnh (giới thiệu, FAQ, bảng giá...). */
export default async function StaticPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPostBySlugOrNotFound(slug);
  const related = await getRelatedPosts(slug, 4);
  return <PostDetail post={post} related={related} />;
}
