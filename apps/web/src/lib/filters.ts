import { PostType } from '@phuochai/shared';
import type { PostFilterInput } from '@/generated/graphql';
import type { ListingFilters } from '@/components/site/filter-panel';

export interface FilterContext {
  type?: PostType;
  filters: ListingFilters;
  page: number;
  pageSize: number;
  keyword?: string;
  /** Chỉ lấy bài đã xuất bản (mặc định true cho trang công khai). */
  publishedOnly?: boolean;
}

/**
 * Dựng `PostFilterInput` từ state của UI.
 * Dùng chung cho cả server (SSR trang danh sách) và client (Apollo query) để
 * biến (variables) khớp nhau tuyệt đối - nhờ đó dữ liệu SSR được hydrate vào cache.
 */
export function buildPostFilter({
  type,
  filters,
  page,
  pageSize,
  keyword,
  publishedOnly = true,
}: FilterContext): PostFilterInput {
  return {
    ...(type ? { type } : {}),
    page,
    pageSize,
    ...(filters.categorySlug ? { categorySlug: filters.categorySlug } : {}),
    ...(filters.ward ? { ward: filters.ward } : {}),
    ...(filters.minPrice != null ? { minPrice: filters.minPrice } : {}),
    ...(filters.maxPrice != null ? { maxPrice: filters.maxPrice } : {}),
    ...(keyword ? { keyword } : {}),
    sortBy: filters.sortBy ?? 'PUBLISHED_AT',
    sortOrder: filters.sortOrder ?? 'DESC',
    ...(publishedOnly ? { status: 'PUBLISHED' as const } : {}),
  };
}
