import type { Metadata } from 'next';
import { buildImageUrl } from '@phuochai/shared';
import { JsonLd } from '@/components/seo/json-ld';
import { PostDetail } from '@/components/site/post-detail';
import { getPostBySlugOrNotFound, getRelatedPosts } from '@/lib/data/posts';
import { postJsonLd } from '@/lib/seo/structured-data';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlugOrNotFound(slug);
  return {
    title: post.seoTitle ?? post.title,
    description: post.summary ?? undefined,
    alternates: { canonical: `/tin-tuc/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.seoTitle ?? post.title,
      description: post.summary ?? undefined,
      images: post.heroImage ? [buildImageUrl(post.heroImage)] : undefined,
    },
  };
}

/** Chi tiết bài viết tin tức / cẩm nang. */
export default async function NewsDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPostBySlugOrNotFound(slug, true);
  const related = await getRelatedPosts(slug, 4);
  return (
    <>
      <JsonLd id="jsonld-post" data={postJsonLd(post)} />
      <PostDetail post={post} related={related} />
    </>
  );
}
