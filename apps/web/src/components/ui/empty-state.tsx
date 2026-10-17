import type { LucideIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  /** Tiêu đề chính, ví dụ "Chưa có bài viết nào". */
  title: string;
  /** Mô tả ngắn bên dưới tiêu đề. */
  description?: string;
  /** Icon lucide hiển thị trong vòng tròn nền muted. */
  icon?: LucideIcon;
  /** Nút hoặc link hành động (thường là <Button asChild><Link/></Button>). */
  action?: React.ReactNode;
  className?: string;
}

/** Trạng thái rỗng dùng cho danh sách, bảng, kết quả tìm kiếm. */
export function EmptyState({ title, description, icon: Icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-card/60 px-6 py-12 text-center',
        className,
      )}
    >
      {Icon ? (
        <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-7" aria-hidden="true" />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
        {description ? (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {action ? <div className="mt-1 flex items-center gap-2">{action}</div> : null}
    </div>
  );
}
