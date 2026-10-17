import { Badge } from '@/components/ui/badge';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string | null;
  children?: React.ReactNode;
}

/** Tiêu đề trang có nền chuyển sắc nhẹ, dùng thống nhất cho mọi trang. */
export function PageHeader({ eyebrow, title, description, children }: PageHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-sea-50 via-background to-sand-50 px-6 py-8 dark:from-sea-900/40 dark:via-background dark:to-sea-900/20">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-sea-100/70 blur-3xl dark:bg-sea-800/40" />
      <div className="relative">
        {eyebrow ? (
          <Badge variant="secondary" className="mb-3 bg-white/80 text-sea-700 dark:bg-sea-900/60 dark:text-sea-100">
            {eyebrow}
          </Badge>
        ) : null}
        <h1 className="font-display text-2xl font-bold leading-tight sm:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
