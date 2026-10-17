'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Building2,
  Eye,
  FileText,
  FolderTree,
  Newspaper,
  Plus,
  TrendingUp,
  Users,
} from 'lucide-react';
import { POST_STATUS_LABELS, formatCompact, formatDateTime } from '@phuochai/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/lib/auth/auth-context';
import { useAdminPostsQuery, useDashboardStatsQuery } from '@/generated/graphql';

/** Dashboard quản trị: thẻ thống kê + phân bố theo loại + bài viết gần đây. */
export function DashboardOverview() {
  const { user, hasRole } = useAuth();
  const { data, loading } = useDashboardStatsQuery({ fetchPolicy: 'cache-and-network' });
  const { data: recent, loading: loadingRecent } = useAdminPostsQuery({
    variables: { filter: { page: 1, pageSize: 8, sortBy: 'CREATED_AT', sortOrder: 'DESC' } },
    fetchPolicy: 'cache-and-network',
  });

  const stats = data?.dashboardStats;
  const visible = hasRole('EDITOR');
  const onlyMine = !visible;

  if (!visible) {
    // Thành viên chỉ thấy bài viết của mình
    return <MemberOverview />;
  }

  if (loading && !stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  const maxTypeCount = Math.max(1, ...(stats?.postsByType.map((item) => item.count) ?? [1]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Xin chào, {user?.name}</h1>
          <p className="text-sm text-muted-foreground">
            Tổng quan nội dung và người dùng của hệ thống danh bạ Phước Hải.
          </p>
        </div>
        <Button asChild>
          <Link href="/quan-tri/bai-viet/moi">
            <Plus className="mr-2 h-4 w-4" /> Thêm bài viết
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Tổng bài viết"
          value={stats?.totalPosts ?? 0}
          icon={FileText}
          hint={`${stats?.publishedPosts ?? 0} đã đăng · ${stats?.draftPosts ?? 0} bản nháp`}
        />
        <StatCard
          title="Nơi lưu trú"
          value={stats?.postsByType.find((item) => item.value === 'ACCOMMODATION')?.count ?? 0}
          icon={Building2}
          hint="Khách sạn, homestay, villa…"
        />
        <StatCard
          title="Tin tức & cẩm nang"
          value={stats?.postsByType.find((item) => item.value === 'NEWS')?.count ?? 0}
          icon={Newspaper}
          hint="Bài viết hướng dẫn du lịch"
        />
        <StatCard
          title="Lượt xem"
          value={formatCompact(stats?.totalViews ?? 0)}
          icon={Eye}
          hint={`${stats?.totalUsers ?? 0} người dùng · ${stats?.totalCategories ?? 0} danh mục`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="border-border/70">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="font-display text-base">Bài viết gần đây</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/quan-tri/bai-viet">
                Xem tất cả <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loadingRecent && !recent ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : (recent?.posts.items.length ?? 0) === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={FileText}
                  title="Chưa có bài viết"
                  description="Hãy import dữ liệu crawl hoặc tạo bài viết đầu tiên."
                  action={
                    <Button asChild>
                      <Link href="/quan-tri/bai-viet/moi">Tạo bài viết</Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tiêu đề</TableHead>
                    <TableHead className="hidden sm:table-cell">Loại</TableHead>
                    <TableHead className="hidden md:table-cell">Trạng thái</TableHead>
                    <TableHead className="hidden lg:table-cell">Ngày tạo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recent?.posts.items.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell className="max-w-[320px]">
                        <Link href={`/quan-tri/bai-viet/${post.id}`} className="line-clamp-1 hover:text-primary">
                          {post.title}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="muted">{post.category?.name ?? post.type}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={post.status === 'PUBLISHED' ? 'success' : post.status === 'DRAFT' ? 'warning' : 'muted'}>
                          {POST_STATUS_LABELS[post.status as keyof typeof POST_STATUS_LABELS] ?? post.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                        {formatDateTime(post.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <BarChart3 className="h-4 w-4 text-sea-600" /> Phân bố theo loại nội dung
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats?.postsByType.map((item) => (
                <div key={item.value}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.round((item.count / maxTypeCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <TrendingUp className="h-4 w-4 text-coral-500" /> Trạng thái xuất bản
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3 text-center">
              {stats?.postsByStatus.map((item) => (
                <div key={item.value} className="rounded-xl bg-muted/60 p-3">
                  <p className="font-display text-lg font-bold">{item.count}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" asChild>
              <Link href="/quan-tri/danh-muc">
                <FolderTree className="mr-2 h-4 w-4" /> Danh mục
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/quan-tri/nguoi-dung">
                <Users className="mr-2 h-4 w-4" /> Người dùng
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Dashboard rút gọn cho thành viên (chỉ thấy bài của mình). */
function MemberOverview() {
  const { data, loading } = useAdminPostsQuery({
    variables: { filter: { onlyMine: true, page: 1, pageSize: 6, sortBy: 'CREATED_AT', sortOrder: 'DESC' } },
    fetchPolicy: 'cache-and-network',
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Bài viết của tôi</h1>
          <p className="text-sm text-muted-foreground">
            Thành viên có thể tạo bản nháp; bài viết sẽ được biên tập viên duyệt và xuất bản.
          </p>
        </div>
        <Button asChild>
          <Link href="/quan-tri/bai-viet/moi">
            <Plus className="mr-2 h-4 w-4" /> Tạo bản nháp
          </Link>
        </Button>
      </div>

      {loading && !data ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : (data?.posts.items.length ?? 0) === 0 ? (
        <EmptyState
          icon={FileText}
          title="Bạn chưa có bài viết nào"
          description="Tạo bản nháp đầu tiên để gửi tới ban biên tập."
          action={
            <Button asChild>
              <Link href="/quan-tri/bai-viet/moi">Tạo bản nháp</Link>
            </Button>
          }
        />
      ) : (
        <Card className="border-border/70">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="hidden sm:table-cell">Ngày tạo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.posts.items.map((post) => (
                  <TableRow key={post.id}>
                    <TableCell>
                      <Link href={`/quan-tri/bai-viet/${post.id}`} className="line-clamp-1 hover:text-primary">
                        {post.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={post.status === 'PUBLISHED' ? 'success' : 'warning'}>
                        {POST_STATUS_LABELS[post.status as keyof typeof POST_STATUS_LABELS] ?? post.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                      {formatDateTime(post.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
