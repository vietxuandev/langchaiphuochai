import type { LucideIcon } from 'lucide-react';
import * as React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  /** Nhãn của số liệu, ví dụ "Lượt xem". */
  title: string;
  /** Giá trị hiển thị (số hoặc chuỗi đã format). */
  value: React.ReactNode;
  icon?: LucideIcon;
  /** Ghi chú nhỏ bên dưới giá trị. */
  hint?: string;
  /** Xu hướng, ví dụ "+12% so với tuần trước". */
  trend?: string;
  className?: string;
}

/** Thẻ số liệu dùng cho dashboard quản trị. */
export function StatCard({ title, value, icon: Icon, hint, trend, className }: StatCardProps) {
  return (
    <Card className={cn('transition-shadow hover:shadow-card', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
      </CardHeader>

      <CardContent className="space-y-1">
        <p className="font-display text-2xl font-semibold tracking-tight">{value}</p>
        {trend ? <p className="text-xs font-medium text-primary">{trend}</p> : null}
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
