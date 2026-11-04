'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AdminNotificationFieldsFragment } from '@/generated/graphql';
import {
  useAdminNotificationsQuery,
  useMarkAdminNotificationReadMutation,
  useMarkAllAdminNotificationsReadMutation,
} from '@/generated/graphql';
import { cn } from '@/lib/utils';
import {
  formatRelativeTime,
  notificationIcon,
  notificationTone,
  safeNotificationUrl,
  unreadDotClass,
} from './notification-utils';

const POLL_INTERVAL = 30_000;

/** Chuông thông báo trên topbar quản trị; poll 30 giây/lần. */
export function AdminNotificationBell() {
  const router = useRouter();
  const { data, loading, startPolling, stopPolling, refetch } = useAdminNotificationsQuery({
    variables: { page: 1, pageSize: 5 },
    pollInterval: POLL_INTERVAL,
    fetchPolicy: 'cache-and-network',
  });
  const [markRead] = useMarkAdminNotificationReadMutation();
  const [markAll] = useMarkAllAdminNotificationsReadMutation();

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling(POLL_INTERVAL);
        void refetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      stopPolling();
    };
  }, [refetch, startPolling, stopPolling]);

  const items = data?.adminNotifications.items ?? [];
  const unreadCount = data?.adminNotifications.unreadCount ?? 0;

  const handleOpen = async (item: AdminNotificationFieldsFragment) => {
    if (!item.readAt) {
      try {
        await markRead({ variables: { id: item.id } });
      } catch {
        // Vẫn cho phép mở link dù đánh dấu đọc thất bại.
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
      // Bỏ qua; lần poll sau sẽ đồng bộ lại.
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Thông báo${unreadCount > 0 ? ` (${unreadCount} chưa đọc)` : ''}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-4 text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Thông báo</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} chưa đọc` : 'Đã đọc tất cả'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={() => void handleMarkAll()}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="h-3.5 w-3.5" /> Đọc tất cả
          </Button>
        </div>

        {loading && items.length === 0 ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
            <Inbox className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium">Chưa có thông báo</p>
            <p className="text-xs text-muted-foreground">Các hoạt động cần xử lý sẽ xuất hiện ở đây.</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {items.map((item) => {
              const Icon = notificationIcon(item.type);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void handleOpen(item)}
                  className={cn(
                    'flex w-full gap-3 border-b px-4 py-3 text-left transition last:border-b-0 hover:bg-muted/60',
                    !item.readAt && 'bg-muted/40',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-9 w-9 shrink-0 place-items-center rounded-full',
                      notificationTone(item.severity),
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2">
                      <span className="line-clamp-2 text-sm font-medium">{item.title}</span>
                      {!item.readAt ? <span className={unreadDotClass(item.severity)} /> : null}
                    </span>
                    {item.body ? (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{item.body}</span>
                    ) : null}
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/quan-tri/thong-bao" className="w-full justify-center text-sm font-medium">
            Xem tất cả thông báo
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
