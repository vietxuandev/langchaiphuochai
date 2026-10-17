import * as React from 'react';

import { cn } from '@/lib/utils';

/** Khối xám nhấp nháy dùng khi đang tải dữ liệu. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

export { Skeleton };
