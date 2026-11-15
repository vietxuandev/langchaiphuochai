'use client';

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
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

const MONTHLY_CONFIG = {
  count: {
    label: 'Bài viết',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig;

const STATUS_CONFIG = {
  DRAFT: {
    label: 'Bản nháp',
    color: 'hsl(var(--accent))',
  },
  PUBLISHED: {
    label: 'Đã đăng',
    color: 'hsl(var(--primary))',
  },
  ARCHIVED: {
    label: 'Lưu trữ',
    color: 'hsl(var(--muted-foreground))',
  },
} satisfies ChartConfig;

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

/** Biểu đồ cột bài viết theo tháng, dùng ChartContainer của shadcn/ui. */
export function PostsByMonthChart({ data }: { data: MonthlyPoint[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Chưa có dữ liệu theo tháng.</p>;
  }

  const points = lastSixMonths(data);

  return (
    <ChartContainer config={MONTHLY_CONFIG} className="h-48 w-full">
      <BarChart accessibilityLayer data={points} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={monthLabel}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={36}
          allowDecimals={false}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent labelFormatter={(value) => monthLabel(String(value))} />}
        />
        <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} maxBarSize={56} />
      </BarChart>
    </ChartContainer>
  );
}

/** Biểu đồ vòng tròn phân bố trạng thái bài viết, dùng ChartContainer của shadcn/ui. */
export function StatusDonutChart({ data, className }: { data: StatusPoint[]; className?: string }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Chưa có dữ liệu trạng thái.</p>;
  }

  return (
    <div className={cn('flex flex-col items-center gap-5 sm:flex-row', className)}>
      <div className="relative h-40 w-40 shrink-0">
        <ChartContainer config={STATUS_CONFIG} className="h-full w-full">
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent nameKey="value" hideLabel />}
            />
            <Pie
              data={data}
              dataKey="count"
              nameKey="value"
              innerRadius={52}
              outerRadius={72}
              strokeWidth={4}
            >
              {data.map((entry) => (
                <Cell key={entry.value} fill={`var(--color-${entry.value})`} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-lg font-bold">{total}</span>
          <span className="text-[10px] text-muted-foreground">bài viết</span>
        </div>
      </div>

      <ul className="w-full space-y-2">
        {data.map((item) => (
          <li key={item.value} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_CONFIG[item.value as keyof typeof STATUS_CONFIG]?.color }}
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
