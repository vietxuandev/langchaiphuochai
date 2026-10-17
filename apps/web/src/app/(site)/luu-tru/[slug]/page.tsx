import type { Metadata } from 'next';
import { buildImageUrl } from '@phuochai/shared';
import { notFound } from 'next/navigation';
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
    alternates: { canonical: `/luu-tru/${post.slug}` },
    openGraph: {
      title: post.seoTitle ?? post.title,
      description: post.summary ?? undefined,
      images: post.heroImage ? [buildImageUrl(post.heroImage)] : undefined,
    },
  };
}

/** Chi tiết nơi lưu trú. */
export default async function AccommodationDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPostBySlugOrNotFound(slug, true);
  const related = await getRelatedPosts(slug, 4);

  if (post.type !== 'ACCOMMODATION' && post.type !== 'PAGE') {
    // Bài thuộc loại khác vẫn hiển thị được nhưng ưu tiên đúng URL.
    notFound();
  }

  return <PostDetail post={post} related={related} />;
}
