'use client';

import Link from 'next/link';
import { Activity, AlertTriangle, Eye, HeartPulse, Link2, MousePointerClick } from 'lucide-react';
import { formatCompact, formatDateTime } from '@phuochai/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DailyCountChart } from '@/components/admin/dashboard-charts';
import { postHref } from '@/components/site/post-card';
import { useDashboardInsightsQuery, type DashboardInsightsQuery } from '@/generated/graphql';

type Insights = DashboardInsightsQuery['dashboardInsights'];
type Issue = Insights['contentHealth'][number];

function itemHref(issueKey: string, id: string): string {
  return issueKey === 'inactiveAffiliate' ? '/quan-tri/affiliate' : `/quan-tri/bai-viet/${id}`;
}

function IssueList({ issues }: { issues: Issue[] }) {
  return (
    <ul className="space-y-3">
      {issues.map((issue) => (
        <li key={issue.key}>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className={issue.count === 0 ? 'text-muted-foreground' : 'font-medium'}>{issue.label}</span>
            <Badge variant={issue.count === 0 ? 'success' : 'warning'}>{issue.count}</Badge>
          </div>
          {issue.items.length > 0 ? (
            <ul className="mt-1 space-y-0.5 border-l pl-3 text-xs text-muted-foreground">
              {issue.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-2">
                  <Link href={itemHref(issue.key, item.id)} className="line-clamp-1 hover:text-primary">
                    {item.title}
                  </Link>
                  {item.detail ? <span className="shrink-0">{item.detail}</span> : null}
                </li>
              ))}
              {issue.count > issue.items.length ? <li>… và {issue.count - issue.items.length} mục khác</li> : null}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Eye; children: React.ReactNode }) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <Icon className="h-4 w-4 text-sea-600" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Các khối thông tin mở rộng của dashboard: sức khoẻ nội dung, cần xử lý, lượt xem, affiliate, hoạt động. */
export function DashboardInsights() {
  const { data, loading, error } = useDashboardInsightsQuery({ fetchPolicy: 'cache-and-network' });
  const insights = data?.dashboardInsights;

  if (!insights) {
    if (error) return null;
    return loading ? <Skeleton className="h-64 rounded-xl" /> : null;
  }
  const { views, affiliate, activity } = insights;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Sức khoẻ nội dung (${insights.publishedChecked} bài đã đăng)`} icon={HeartPulse}>
          <IssueList issues={insights.contentHealth} />
        </Panel>
        <Panel title="Cần xử lý" icon={AlertTriangle}>
          <IssueList issues={insights.attention} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Lượt xem" icon={Eye}>
          <div className="mb-3 flex gap-6 text-sm">
            <div>
              <div className="text-2xl font-bold">{formatCompact(views.last7)}</div>
              <div className="text-muted-foreground">7 ngày</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCompact(views.last30)}</div>
              <div className="text-muted-foreground">30 ngày</div>
            </div>
          </div>
          <DailyCountChart data={views.byDay} />
          <p className="mt-1 text-xs text-muted-foreground">
            {views.trackedSince
              ? `Ghi nhận theo ngày từ ${views.trackedSince}.`
              : 'Chưa có dữ liệu theo ngày; bắt đầu ghi nhận từ lượt xem tiếp theo.'}
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {views.topPosts.slice(0, 5).map((post, index) => (
              <li key={post.id} className="flex items-center justify-between gap-2">
                <a
                  href={postHref({ type: post.type as never, slug: post.slug } as never)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="line-clamp-1 hover:text-primary"
                >
                  {index + 1}. {post.title}
                </a>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatCompact(post.views)} · 30n: {post.views30d}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Affiliate" icon={MousePointerClick}>
          <div className="mb-3 flex flex-wrap gap-6 text-sm">
            <div>
              <div className="text-2xl font-bold">{affiliate.clicks7}</div>
              <div className="text-muted-foreground">click 7 ngày</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{affiliate.clicks30}</div>
              <div className="text-muted-foreground">click 30 ngày</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {affiliate.activeLinks}/{affiliate.totalLinks}
              </div>
              <div className="text-muted-foreground">link đang bật</div>
            </div>
          </div>
          <DailyCountChart data={affiliate.byDay} label="Click" />
          <ul className="mt-3 space-y-1.5 text-sm">
            {affiliate.topLinks.length === 0 ? (
              <li className="text-muted-foreground">Chưa có link affiliate.</li>
            ) : (
              affiliate.topLinks.map((link) => (
                <li key={link.id} className="flex items-center justify-between gap-2">
                  <Link href="/quan-tri/affiliate" className="line-clamp-1 hover:text-primary">
                    <Link2 className="mr-1 inline h-3.5 w-3.5" />
                    {link.title}
                    {link.isActive ? '' : ' (tắt)'}
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {link.clicks} · 30n: {link.clicks30d}
                  </span>
                </li>
              ))
            )}
          </ul>
        </Panel>
      </div>

      <Panel title="Hoạt động MCP / crawl" icon={Activity}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              7 ngày: {activity.mcpCalls7d} lệnh MCP
              {activity.mcpErrors7d > 0 ? `, ${activity.mcpErrors7d} lỗi` : ''}
            </p>
            {activity.recentMcp.length === 0 ? (
              <p className="text-sm text-muted-foreground">Chưa có hoạt động MCP.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {activity.recentMcp.map((log) => (
                  <li key={log.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Badge variant={log.status === 'ok' ? 'success' : 'warning'}>{log.status}</Badge>
                      <code className="text-xs">{log.tool}</code>
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="text-sm">
            <p className="mb-2 font-medium">Lần import gần nhất</p>
            {activity.lastImport ? (
              <p className="text-muted-foreground">
                {activity.lastImport.source} · {formatDateTime(activity.lastImport.startedAt)}
                <br />
                Tạo {activity.lastImport.created} · cập nhật {activity.lastImport.updated} · bỏ qua{' '}
                {activity.lastImport.skipped}
              </p>
            ) : (
              <p className="text-muted-foreground">Chưa có lần import nào.</p>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
}
