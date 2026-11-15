'use client';

import { cn } from '@/lib/utils';

interface MonthlyPoint {
  month: string;
  count: number;
}

interface StatusPoint {
  label: string;
  value: string;
  count: number;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#f59e0b',
  PUBLISHED: '#14807f',
  ARCHIVED: '#94a3b8',
};

function statusColor(value: string, index: number): string {
  return STATUS_COLORS[value] ?? ['#14807f', '#f59e0b', '#94a3b8'][index % 3];
}

function monthLabel(value: string): string {
  const [year, month] = value.split('-');
  return `${month}/${year?.slice(2) ?? ''}`;
}

/** Bổ sung các tháng trống để biểu đồ luôn có 6 cột gần nhất. */
function lastSixMonths(data: MonthlyPoint[]): MonthlyPoint[] {
  const byMonth = new Map(data.map((item) => [item.month, item.count]));
  const now = new Date();
  const points: MonthlyPoint[] = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    points.push({ month: key, count: byMonth.get(key) ?? 0 });
  }
  return points;
}

/** Biểu đồ cột bài viết theo tháng cho dashboard. */
export function PostsByMonthChart({ data }: { data: MonthlyPoint[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Chưa có dữ liệu theo tháng.</p>;
  }

  const points = lastSixMonths(data);
  const max = Math.max(1, ...points.map((item) => item.count));

  return (
    <div>
      <div className="flex h-48 items-end gap-2 sm:gap-4" role="img" aria-label="Biểu đồ bài viết 6 tháng gần nhất">
        {points.map((item) => {
          const height = Math.round((item.count / max) * 100);
          return (
            <div key={item.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <span className="text-[11px] font-medium tabular-nums text-muted-foreground">{item.count}</span>
              <div className="flex h-32 w-full max-w-20 items-end rounded-md bg-muted/60">
                <div
                  className="w-full rounded-t-md bg-primary transition-all hover:bg-sea-700"
                  style={{ height: item.count === 0 ? 0 : `${Math.max(4, height)}%` }}
                  title={`${monthLabel(item.month)}: ${item.count} bài`}
                />
              </div>
              <span className="truncate text-[10px] text-muted-foreground sm:text-xs">{monthLabel(item.month)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Biểu đồ vòng tròn phân bố trạng thái bài viết. */
export function StatusDonutChart({ data, className }: { data: StatusPoint[]; className?: string }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Chưa có dữ liệu trạng thái.</p>;
  }

  let cursor = 0;
  const stops = data.map((item, index) => {
    const start = cursor;
    const end = start + (item.count / total) * 100;
    cursor = end;
    return `${statusColor(item.value, index)} ${start}% ${end}%`;
  });

  return (
    <div className={cn('flex flex-col items-center gap-5 sm:flex-row', className)}>
      <div
        className="relative grid size-32 shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(${stops.join(', ')})` }}
        role="img"
        aria-label="Biểu đồ phân bố trạng thái bài viết"
      >
        <div className="grid size-20 place-items-center rounded-full bg-card text-center">
          <div>
            <p className="font-display text-lg font-bold">{total}</p>
            <p className="text-[10px] text-muted-foreground">bài viết</p>
          </div>
        </div>
      </div>

      <ul className="w-full space-y-2">
        {data.map((item, index) => (
          <li key={item.value} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: statusColor(item.value, index) }}
              />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="font-semibold tabular-nums">{item.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
