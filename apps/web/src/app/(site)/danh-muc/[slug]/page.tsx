import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PostType } from '@phuochai/shared';
import { PageHeader } from '@/components/site/page-header';
import { PostListing } from '@/components/site/post-listing';
import { getCategoryBySlug } from '@/lib/data/category';
import { getPosts } from '@/lib/data/posts';
import { buildPostFilter } from '@/lib/filters';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: 'Không tìm thấy danh mục' };
  return {
    title: category.seoTitle ?? category.name,
    description: category.description ?? undefined,
    alternates: { canonical: `/danh-muc/${category.slug}` },
  };
}

/** Trang danh mục: hiển thị danh mục cha + danh mục con dưới dạng liên kết nhanh. */
export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const initialFilters = { categorySlug: category.slug, sortBy: 'PUBLISHED_AT' as const, sortOrder: 'DESC' as const };
  const [initialPosts] = await Promise.all([
    getPosts(
      buildPostFilter({
        type: category.section as PostType,
        filters: initialFilters,
        page: 1,
        pageSize: 12,
      }),
    ),
  ]);
  const options = (category.children.length > 0 ? category.children : [category]).map((item) => ({
    id: item.id,
    name: item.name,
    slug: item.slug,
    postCount: item.postCount,
  }));

  return (
    <div className="container py-8">
      <PageHeader
        eyebrow={category.parent?.name ?? 'Danh mục'}
        title={category.name}
        description={category.description}
      >
        {category.children.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {category.children.map((child) => (
              <a
                key={child.id}
                href={`/danh-muc/${child.slug}`}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium transition hover:border-primary hover:text-primary"
              >
                {child.name} · {child.postCount}
              </a>
            ))}
          </div>
        ) : null}
      </PageHeader>

      <div className="mt-8">
        <PostListing
          type={category.section as PostType}
          categories={options}
          initialFilters={initialFilters}
          initialFiltersFromServer={initialFilters}
          initialData={{ posts: initialPosts }}
        />
      </div>
    </div>
  );
}
