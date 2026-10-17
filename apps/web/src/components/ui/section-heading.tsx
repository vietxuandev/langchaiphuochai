import * as React from 'react';

import { cn } from '@/lib/utils';

export interface SectionHeadingProps {
  /** Nhãn nhỏ phía trên tiêu đề, ví dụ "Khám phá". */
  eyebrow?: string;
  title: string;
  description?: string;
  /** Nút/link nằm bên phải tiêu đề (khi align="left"). */
  action?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
}

/** Tiêu đề cho các khối nội dung ở trang chủ / trang danh sách. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = 'left',
  className,
}: SectionHeadingProps) {
  const centered = align === 'center';

  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        centered && 'sm:flex-col sm:items-center',
        className,
      )}
    >
      <div className={cn('max-w-2xl space-y-2', centered && 'mx-auto text-center')}>
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
        ) : null}

        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h2>

        {description ? <p className="text-muted-foreground">{description}</p> : null}
      </div>

      {action ? <div className={cn('shrink-0', centered && 'mx-auto')}>{action}</div> : null}
    </div>
  );
}
