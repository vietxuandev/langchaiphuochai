'use client';

import Link from 'next/link';
import {
  Archive,
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  Eye,
  FileText,
  FolderTree,
  Pencil,
  Plus,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import { POST_STATUS_LABELS, PostStatus, Role, formatCompact, formatDateTime } from '@phuochai/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PostsByMonthChart, StatusDonutChart } from '@/components/admin/dashboard-charts';
import { postHref } from '@/components/site/post-card';
import { useAuth } from '@/lib/auth/auth-context';
import {
  useAdminNotificationsQuery,
  useAdminPostsQuery,
  useDashboardStatsQuery,
  usePendingUserCountQuery,
} from '@/generated/graphql';

/** Dashboard quản trị: thẻ thống kê + phân bố theo loại + bài viết gần đây. */
export function DashboardOverview() {
  const { user, hasRole } = useAuth();
  const { data, loading } = useDashboardStatsQuery({ fetchPolicy: 'cache-and-network' });
  const { data: recent, loading: loadingRecent } = useAdminPostsQuery({
    variables: { filter: { page: 1, pageSize: 8, sortBy: 'CREATED_AT', sortOrder: 'DESC' } },
    fetchPolicy: 'cache-and-network',
  });
  const isAdmin = hasRole(Role.ADMIN);
  const visible = hasRole(Role.EDITOR);
  const { data: pendingData } = usePendingUserCountQuery({
    skip: !isAdmin,
    fetchPolicy: 'cache-and-network',
  });
  const { data: notificationData } = useAdminNotificationsQuery({
    variables: { page: 1, pageSize: 1 },
    skip: !visible,
    fetchPolicy: 'cache-and-network',
  });

  const stats = data?.dashboardStats;
  const pendingCount = pendingData?.pendingUserCount ?? 0;
  const unreadCount = notificationData?.adminNotifications.unreadCount ?? 0;

  if (!visible) {
    // Thành viên chỉ thấy bài viết của mình
    return <MemberOverview />;
  }

  if (loading && !stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
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
          title="Đã xuất bản"
          value={stats?.publishedPosts ?? 0}
          icon={CheckCircle2}
          hint="Bài đang hiển thị công khai"
        />
        <StatCard
          title="Bản nháp"
          value={stats?.draftPosts ?? 0}
          icon={FileText}
          hint="Cần hoàn thiện hoặc chờ duyệt"
        />
        <StatCard
          title="Lưu trữ"
          value={stats?.archivedPosts ?? 0}
          icon={Archive}
          hint="Bài đã ẩn khỏi website"
        />
        <StatCard
          title="Lượt xem"
          value={formatCompact(stats?.totalViews ?? 0)}
          icon={Eye}
          hint="Tổng lượt xem nội dung"
        />
        <StatCard
          title="Người dùng"
          value={stats?.totalUsers ?? 0}
          icon={Users}
          hint="Tài khoản trong hệ thống"
        />
        {isAdmin ? (
          <StatCard
            title="Chờ duyệt"
            value={pendingCount}
            icon={UserPlus}
            hint="Tài khoản đăng ký mới"
          />
        ) : (
          <StatCard
            title="Danh mục"
            value={stats?.totalCategories ?? 0}
            icon={FolderTree}
            hint="Danh mục đang quản lý"
          />
        )}
        <StatCard
          title="Thông báo"
          value={unreadCount}
          icon={Bell}
          hint="Thông báo chưa đọc"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <BarChart3 className="h-4 w-4 text-sea-600" /> Bài viết theo tháng
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PostsByMonthChart data={stats?.postsByMonth ?? []} />
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-base">
              <TrendingUp className="h-4 w-4 text-coral-500" /> Trạng thái xuất bản
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StatusDonutChart data={stats?.postsByStatus ?? []} />
          </CardContent>
        </Card>
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
                    <TableHead className="w-20" />
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
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {post.status === 'PUBLISHED' ? (
                            <Button variant="ghost" size="icon" asChild title="Xem trên website">
                              <a
                                href={postHref(post)}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Xem trên website"
                              >
                                <Eye className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : null}
                          <Button variant="ghost" size="icon" asChild title="Chỉnh sửa">
                            <Link href={`/quan-tri/bai-viet/${post.id}`} aria-label="Chỉnh sửa">
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
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
  const { data: draftData } = useAdminPostsQuery({
    variables: { filter: { onlyMine: true, status: PostStatus.DRAFT, page: 1, pageSize: 1 } },
    fetchPolicy: 'cache-and-network',
  });
  const totalMine = data?.posts.total ?? 0;
  const draftMine = draftData?.posts.total ?? 0;
  const publishedMine = Math.max(0, totalMine - draftMine);

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

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Bài viết của tôi" value={totalMine} icon={FileText} hint="Tất cả bài đã tạo" />
        <StatCard title="Bản nháp" value={draftMine} icon={FileText} hint="Chưa gửi duyệt" />
        <StatCard title="Đã xuất bản" value={publishedMine} icon={CheckCircle2} hint="Đang hiển thị công khai" />
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
                  <TableHead className="w-20" />
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
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {post.status === 'PUBLISHED' ? (
                          <Button variant="ghost" size="icon" asChild title="Xem trên website">
                            <a
                              href={postHref(post)}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Xem trên website"
                            >
                              <Eye className="h-4 w-4" />
                            </a>
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="icon" asChild title="Chỉnh sửa">
                          <Link href={`/quan-tri/bai-viet/${post.id}`} aria-label="Chỉnh sửa">
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
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
