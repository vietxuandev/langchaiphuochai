import {
  Bell,
  DownloadCloud,
  FileText,
  ShieldAlert,
  TriangleAlert,
  UploadCloud,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/** Icon theo loại thông báo; fallback là chuông. */
export function notificationIcon(type: string): LucideIcon {
  switch (type) {
    case 'USER_PENDING':
      return UserPlus;
    case 'POST_PENDING':
    case 'POST_PUBLISHED':
      return FileText;
    case 'SECURITY_LOGIN_FAILED':
      return ShieldAlert;
    case 'CRAWL_COMPLETED':
    case 'CRAWL_FAILED':
      return DownloadCloud;
    case 'UPLOAD_FAILED':
      return UploadCloud;
    case 'SYSTEM_ERROR':
      return TriangleAlert;
    default:
      return Bell;
  }
}

/** Màu nền icon theo mức độ. */
export function notificationTone(severity: string): string {
  switch (severity) {
    case 'URGENT':
      return 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300';
    case 'WARNING':
      return 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300';
    default:
      return 'bg-sea-50 text-sea-700 dark:bg-sea-900/50 dark:text-sea-200';
  }
}

/** Chỉ cho phép link nội bộ trong khu vực quản trị. */
export function safeNotificationUrl(url?: string | null): string | null {
  if (!url) return null;
  return url.startsWith('/quan-tri') ? url : null;
}

/** Thời gian tương đối, đủ ngắn để hiển thị trong dropdown. */
export function formatRelativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSeconds < 60) return 'Vừa xong';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ngày trước`;

  return date.toLocaleDateString('vi-VN');
}

/** Class cho chấm đánh dấu chưa đọc. */
export function unreadDotClass(severity: string): string {
  return cn(
    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
    severity === 'URGENT' ? 'bg-red-500' : severity === 'WARNING' ? 'bg-amber-500' : 'bg-sea-500',
  );
}
