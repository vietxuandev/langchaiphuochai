import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface LoadingSpinnerProps {
  className?: string;
  /** Chữ hiển thị kèm spinner; nếu bỏ trống chỉ có icon quay. */
  label?: string;
}

/** Vòng xoay báo đang tải dữ liệu. */
export function LoadingSpinner({ className, label }: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('inline-flex items-center gap-2 text-muted-foreground', className)}
    >
      <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
      {label ? <span className="text-sm">{label}</span> : <span className="sr-only">Đang tải…</span>}
    </div>
  );
}
