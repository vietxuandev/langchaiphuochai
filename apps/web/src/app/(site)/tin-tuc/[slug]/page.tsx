import type { Metadata } from 'next';
import { buildImageUrl } from '@phuochai/shared';
import { JsonLd } from '@/components/seo/json-ld';
import { PostDetail } from '@/components/site/post-detail';
import { getPostBySlugOrNotFound, getRelatedPosts } from '@/lib/data/posts';
import { isThinContent } from '@/lib/seo/content-quality';
import { postJsonLd } from '@/lib/seo/structured-data';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 300;
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlugOrNotFound(slug);
  return {
    robots: isThinContent(post.type, post.contentHtml) ? { index: false, follow: true } : undefined,
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.summary ?? undefined,
    alternates: { canonical: `/tin-tuc/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.seoTitle ?? post.title,
      description: post.seoDescription ?? post.summary ?? undefined,
      images: post.heroImage ? [buildImageUrl(post.heroImage)] : undefined,
    },
  };
}

/** Chi tiết bài viết tin tức / cẩm nang. */
export default async function NewsDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getPostBySlugOrNotFound(slug);
  const related = await getRelatedPosts(slug, 4);
  return (
    <>
      <JsonLd id="jsonld-post" data={postJsonLd(post)} />
      <PostDetail post={post} related={related} />
    </>
  );
}
