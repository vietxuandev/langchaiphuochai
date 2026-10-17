import { PageHeader } from '@/components/site/page-header';
import { PostListing } from '@/components/site/post-listing';
import { PostType, canonicalWardName } from '@phuochai/shared';
import type { CategoryOption, ListingFilters } from '@/components/site/filter-panel';
import { getNavCategories } from '@/lib/data/categories';
import { getPosts } from '@/lib/data/posts';
import { buildPostFilter } from '@/lib/filters';

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/** Đọc bộ lọc từ query string để SSR/refresh vẫn giữ trạng thái. */
export function readFilters(searchParams: SearchParams): ListingFilters {
  return {
    categorySlug: first(searchParams['danh-muc']),
    // Chỉ nhận xã/phường có trong danh mục; giá trị lạ trên URL bị bỏ qua thay vì gây lỗi.
    ward: canonicalWardName(first(searchParams['xa-phuong'])) ?? undefined,
    minPrice: first(searchParams['gia-tu']) ? Number(first(searchParams['gia-tu'])) : undefined,
    maxPrice: first(searchParams['gia-den']) ? Number(first(searchParams['gia-den'])) : undefined,
    sortBy: (first(searchParams['sap-xep']) as ListingFilters['sortBy']) ?? 'PUBLISHED_AT',
    sortOrder: (first(searchParams['thu-tu']) as ListingFilters['sortOrder']) ?? 'DESC',
  };
}

interface ListingPageProps {
  /** Loại nội dung; bỏ trống cho trang tìm kiếm. */
  type?: PostType;
  eyebrow: string;
  title: string;
  description?: string;
  searchParams: SearchParams;
  keyword?: string;
  pageSize?: number;
}

/** Khung trang danh sách dùng chung: tiêu đề + bộ lọc + lưới bài viết. */
export async function ListingPage({
  type,
  eyebrow,
  title,
  description,
  searchParams,
  keyword,
  pageSize = 12,
}: ListingPageProps) {
  const initialFilters = readFilters(searchParams);
  const [categories, initialPosts] = await Promise.all([
    getNavCategories(),
    // Lấy sẵn trang 1 ở server để HTML có dữ liệu (SEO) và client không phải chờ.
    getPosts(buildPostFilter({ type, filters: initialFilters, page: 1, pageSize, keyword })),
  ]);

  const sectionCategories: CategoryOption[] = (type
    ? categories.filter((category) => category.section === type && category.level >= 1)
    : categories.filter((category) => category.level >= 1)
  ).map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    postCount: category.postCount,
    level: category.level,
  }));

  return (
    <div className="container py-8">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />

      <div className="mt-8">
        <PostListing
          type={type}
          categories={sectionCategories}
          initialFilters={initialFilters}
          initialFiltersFromServer={initialFilters}
          initialData={{ posts: initialPosts }}
          keyword={keyword}
          pageSize={pageSize}
        />
      </div>
    </div>
  );
}
