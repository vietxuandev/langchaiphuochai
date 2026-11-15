'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import * as RechartsPrimitive from 'recharts';

// Định dạng: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: '', dark: '.dark' } as const;

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
>;

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error('useChart phải được dùng bên trong <ChartContainer />');
  }
  return context;
}

/** Khung chart theo shadcn/ui, dùng Recharts bên dưới. */
function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<'div'> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children'];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, '')}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={cn(
          'flex justify-center text-xs',
          '[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground',
          '[&_.recharts-cartesian-grid_line[stroke="#ccc"]]:stroke-border/50',
          '[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border',
          '[&_.recharts-dot[stroke="#fff"]]:stroke-transparent',
          '[&_.recharts-layer]:outline-none',
          '[&_.recharts-polar-grid_[stroke="#ccc"]]:stroke-border',
          '[&_.recharts-radial-bar-background-sector]:fill-muted',
          '[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted',
          '[&_.recharts-reference-line_[stroke="#ccc"]]:stroke-border',
          '[&_.recharts-sector]:outline-none',
          '[&_.recharts-sector[stroke="#fff"]]:stroke-transparent',
          '[&_.recharts-surface]:outline-none',
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(([, item]) => item.theme ?? item.color);

  if (colorConfig.length === 0) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, item]) => {
    const color = item.theme?.[theme as keyof typeof item.theme] ?? item.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .join('\n')}
}
`,
          )
          .join('\n'),
      }}
    />
  );
}

const ChartTooltip = RechartsPrimitive.Tooltip;

interface ChartTooltipItem {
  color?: string;
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  payload?: Record<string, unknown> & { fill?: string };
  type?: string;
}

/** Nội dung tooltip theo shadcn/ui, đã rút gọn cho nhu cầu dashboard. */
function ChartTooltipContent({
  active,
  payload,
  className,
  label,
  labelFormatter,
  hideLabel = false,
  hideIndicator = false,
  indicator = 'dot',
  nameKey,
}: React.ComponentProps<'div'> & {
  active?: boolean;
  payload?: readonly ChartTooltipItem[];
  label?: string | number;
  labelFormatter?: (value: React.ReactNode, payload: readonly ChartTooltipItem[]) => React.ReactNode;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: 'line' | 'dot' | 'dashed';
  nameKey?: string;
}) {
  const { config } = useChart();

  if (!active || !payload?.length) return null;

  const tooltipLabel = hideLabel
    ? null
    : labelFormatter
      ? labelFormatter(label, payload)
      : typeof label === 'string'
        ? (config[label]?.label ?? label)
        : label;

  return (
    <div
      className={cn(
        'grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl',
        className,
      )}
    >
      {tooltipLabel ? <div className="font-medium">{tooltipLabel}</div> : null}
      <div className="grid gap-1.5">
        {payload
          .filter((item) => item.type !== 'none')
          .map((item, index) => {
            const key = `${nameKey ?? item.dataKey ?? item.name ?? 'value'}`;
            const itemConfig = config[key] ?? (item.name ? config[String(item.name)] : undefined);
            const indicatorColor = item.color ?? item.payload?.fill;

            return (
              <div key={index} className="flex w-full items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  {!hideIndicator ? (
                    <span
                      className={cn('shrink-0 rounded-[2px]', {
                        'h-2.5 w-2.5': indicator === 'dot',
                        'h-2.5 w-1': indicator === 'line',
                        'h-2.5 w-0 border-[1.5px] border-dashed bg-transparent': indicator === 'dashed',
                      })}
                      style={{ backgroundColor: indicator === 'dashed' ? 'transparent' : indicatorColor }}
                    />
                  ) : null}
                  {itemConfig?.label ?? item.name}
                </span>
                {item.value != null ? (
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {typeof item.value === 'number' ? item.value.toLocaleString() : String(item.value)}
                  </span>
                ) : null}
              </div>
            );
          })}
      </div>
    </div>
  );
}

export { ChartContainer, ChartTooltip, ChartTooltipContent };
