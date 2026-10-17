'use client';

import { useMemo, useState } from 'react';
import { useApolloClient } from '@apollo/client';
import { PackageOpen } from 'lucide-react';
import { PostType } from '@phuochai/shared';
import { PostCard } from '@/components/site/post-card';
import { FilterPanel, useFilterUrlSync, type CategoryOption, type ListingFilters } from '@/components/site/filter-panel';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { buildPostFilter } from '@/lib/filters';
import { PostsDocument, usePostsQuery, type PostsQuery } from '@/generated/graphql';

interface PostListingProps {
  /** Bỏ trống để tìm kiếm trên mọi loại nội dung. */
  type?: PostType;
  categories: CategoryOption[];
  initialFilters?: ListingFilters;
  keyword?: string;
  pageSize?: number;
  /** Bộ lọc đã dùng khi render server (phải khớp `initialFilters`). */
  initialFiltersFromServer?: ListingFilters;
  /** Kết quả query trang 1 đã lấy ở server - dùng để hydrate cache, tránh nhấp nháy. */
  initialData?: PostsQuery | null;
}

/** Khối danh sách bài viết có bộ lọc + phân trang, dùng chung cho mọi loại nội dung. */
export function PostListing({
  type,
  categories,
  initialFilters,
  keyword,
  pageSize = 12,
  initialFiltersFromServer,
  initialData,
}: PostListingProps) {
  const client = useApolloClient();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<ListingFilters>(
    initialFilters ?? { sortBy: 'PUBLISHED_AT', sortOrder: 'DESC' },
  );
  const syncUrl = useFilterUrlSync(type ?? PostType.ACCOMMODATION);

  /**
   * Nạp dữ liệu SSR vào cache Apollo ngay trong lần render đầu tiên
   * (chạy trước `usePostsQuery` bên dưới nên query đọc được cache, không gọi mạng lại).
   */
  useState(() => {
    if (!initialData?.posts) return true;
    const serverFilters = initialFiltersFromServer ?? initialFilters ?? {};
    const variables = {
      filter: buildPostFilter({
        type,
        filters: serverFilters,
        page: 1,
        pageSize,
        keyword,
      }),
    };
    try {
      client.cache.writeQuery({ query: PostsDocument, variables, data: initialData });
    } catch {
      // Bỏ qua nếu cấu trúc cache không khớp - component sẽ tự fetch như bình thường.
    }
    return true;
  });

  const filter = useMemo(
    () => buildPostFilter({ type, filters, page, pageSize, keyword }),
    [type, filters, page, pageSize, keyword],
  );

  const { data, loading, error } = usePostsQuery({
    variables: { filter },
    notifyOnNetworkStatusChange: true,
    fetchPolicy: 'cache-first',
    nextFetchPolicy: 'cache-first',
  });

  const posts = data?.posts.items ?? [];
  const total = data?.posts.total ?? 0;
  const totalPages = data?.posts.totalPages ?? 1;

  const handleFilterChange = (next: ListingFilters) => {
    setFilters(next);
    setPage(1);
    syncUrl(next);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="lg:order-1">
        <FilterPanel
          type={type ?? PostType.ACCOMMODATION}
          categories={categories}
          filters={filters}
          total={total}
          onChange={handleFilterChange}
        />
      </div>

      <div className="lg:order-2">
        {error ? (
          <EmptyState
            icon={PackageOpen}
            title="Không tải được danh sách"
            description="Vui lòng kiểm tra kết nối tới API hoặc thử lại sau ít phút."
          />
        ) : loading && posts.length === 0 && !initialData ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="space-y-3">
                <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title="Chưa có kết quả phù hợp"
            description="Hãy thử mở rộng khoảng giá hoặc bỏ bớt điều kiện lọc."
          />
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {posts.map((post, index) => (
                <PostCard key={post.id} post={post} priority={index < 3} />
              ))}
            </div>

            <div className="mt-8 flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Hiển thị {posts.length} / {total} kết quả
              </p>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
