'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import type { AdminNotificationFieldsFragment } from '@/generated/graphql';
import {
  useAdminNotificationsQuery,
  useMarkAdminNotificationReadMutation,
  useMarkAllAdminNotificationsReadMutation,
} from '@/generated/graphql';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Pagination } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import {
  formatRelativeTime,
  notificationIcon,
  notificationTone,
  safeNotificationUrl,
  unreadDotClass,
} from './notification-utils';

const PAGE_SIZE = 20;

/** Trang danh sách thông báo quản trị, có lọc chưa đọc và phân trang. */
export function AdminNotificationsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, loading, refetch } = useAdminNotificationsQuery({
    variables: {
      page,
      pageSize: PAGE_SIZE,
      ...(unreadOnly ? { filter: { unreadOnly: true } } : {}),
    },
    fetchPolicy: 'cache-and-network',
  });
  const [markRead] = useMarkAdminNotificationReadMutation();
  const [markAll] = useMarkAllAdminNotificationsReadMutation();

  const items = data?.adminNotifications.items ?? [];
  const total = data?.adminNotifications.total ?? 0;
  const totalPages = data?.adminNotifications.totalPages ?? 1;
  const unreadCount = data?.adminNotifications.unreadCount ?? 0;

  const handleOpen = async (item: AdminNotificationFieldsFragment) => {
    if (!item.readAt) {
      try {
        await markRead({ variables: { id: item.id } });
      } catch {
        // Không chặn việc mở liên kết nếu đánh dấu đọc lỗi.
      }
    }

    await refetch();
    router.push(safeNotificationUrl(item.actionUrl) ?? '/quan-tri/thong-bao');
  };

  const handleMarkAll = async () => {
    try {
      await markAll();
      await refetch();
    } catch {
      // Poll/lần tải sau sẽ đồng bộ lại.
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Thông báo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} chưa đọc` : 'Đã đọc tất cả'} · {total} thông báo
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={unreadOnly ? 'outline' : 'default'}
            size="sm"
            onClick={() => {
              setUnreadOnly(false);
              setPage(1);
            }}
          >
            Tất cả
          </Button>
          <Button
            variant={unreadOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setUnreadOnly(true);
              setPage(1);
            }}
          >
            Chưa đọc
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleMarkAll()}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="mr-2 h-4 w-4" /> Đọc tất cả
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading && items.length === 0 ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Bell}
              title={unreadOnly ? 'Không còn thông báo chưa đọc' : 'Chưa có thông báo'}
              description={
                unreadOnly
                  ? 'Bạn đã xử lý hết các thông báo chưa đọc.'
                  : 'Các hoạt động cần quản trị viên xử lý sẽ xuất hiện ở đây.'
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => {
              const Icon = notificationIcon(item.type);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void handleOpen(item)}
                  className={cn(
                    'flex w-full gap-4 px-4 py-4 text-left transition hover:bg-muted/50 sm:px-6',
                    !item.readAt && 'bg-muted/30',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-10 w-10 shrink-0 place-items-center rounded-full',
                      notificationTone(item.severity),
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2">
                      <span className="text-sm font-semibold sm:text-base">{item.title}</span>
                      {!item.readAt ? <span className={unreadDotClass(item.severity)} /> : null}
                    </span>
                    {item.body ? (
                      <span className="mt-1 block text-sm text-muted-foreground">{item.body}</span>
                    ) : null}
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
