'use client';

import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PaginationProps {
  /** Trang hiện tại, tính từ 1. */
  page: number;
  /** Tổng số trang. */
  totalPages: number;
  /** Gọi khi người dùng chọn trang khác. */
  onPageChange: (page: number) => void;
  /** Số trang hiển thị mỗi bên của trang hiện tại (mặc định 1). */
  siblingCount?: number;
  /** Ẩn/hiện nút "Trước" và "Sau" (mặc định hiện). */
  showLabels?: boolean;
  className?: string;
}

type PageItem = number | 'ellipsis-left' | 'ellipsis-right';

function range(start: number, end: number) {
  return Array.from({ length: Math.max(end - start + 1, 0) }, (_, index) => start + index);
}

/** Tính danh sách trang cần hiển thị, chèn dấu "..." khi danh sách quá dài. */
function getPageItems(current: number, total: number, siblingCount: number): PageItem[] {
  const totalSlots = siblingCount * 2 + 5;
  if (total <= totalSlots) {
    return range(1, total);
  }

  const leftSibling = Math.max(current - siblingCount, 1);
  const rightSibling = Math.min(current + siblingCount, total);
  const showLeftGap = leftSibling > 2;
  const showRightGap = rightSibling < total - 1;

  if (!showLeftGap && showRightGap) {
    return [...range(1, siblingCount * 2 + 3), 'ellipsis-right', total];
  }

  if (showLeftGap && !showRightGap) {
    return [1, 'ellipsis-left', ...range(total - (siblingCount * 2 + 3) + 1, total)];
  }

  return [1, 'ellipsis-left', ...range(leftSibling, rightSibling), 'ellipsis-right', total];
}

/**
 * Phân trang thuần (không phụ thuộc Radix), dùng cho danh sách bài viết/dự án.
 * Component không tự quản lý state - hãy truyền `page` + `onPageChange`.
 */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  siblingCount = 1,
  showLabels = true,
  className,
}: PaginationProps) {
  // Không cần phân trang khi chỉ có 0 hoặc 1 trang.
  if (totalPages <= 1) {
    return null;
  }

  const current = Math.min(Math.max(page, 1), totalPages);
  const items = getPageItems(current, totalPages, siblingCount);

  return (
    <nav
      aria-label="Phân trang"
      className={cn('flex flex-wrap items-center justify-center gap-1', className)}
    >
      <Button
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={() => onPageChange(current - 1)}
        disabled={current <= 1}
        aria-label="Trang trước"
      >
        <ChevronLeft className="size-4" />
        {showLabels ? <span className="hidden sm:inline">Trước</span> : null}
      </Button>

      {items.map((item) =>
        typeof item === 'number' ? (
          <Button
            key={item}
            variant={item === current ? 'default' : 'ghost'}
            size="icon"
            className="size-9"
            aria-label={`Trang ${item}`}
            aria-current={item === current ? 'page' : undefined}
            onClick={() => {
              if (item !== current) {
                onPageChange(item);
              }
            }}
          >
            {item}
          </Button>
        ) : (
          <span
            key={item}
            aria-hidden="true"
            className="flex size-9 items-center justify-center text-muted-foreground"
          >
            <MoreHorizontal className="size-4" />
          </span>
        ),
      )}

      <Button
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={() => onPageChange(current + 1)}
        disabled={current >= totalPages}
        aria-label="Trang sau"
      >
        {showLabels ? <span className="hidden sm:inline">Sau</span> : null}
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}
