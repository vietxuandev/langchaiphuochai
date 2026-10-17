'use client';

import { useEffect, useState } from 'react';
import { buildImageUrl } from '@phuochai/shared';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  name: string;
  /** Đường dẫn ảnh trên máy chủ mới (/upload/...) - rỗng thì hiển thị chữ cái đầu. */
  avatarUrl?: string | null;
  className?: string;
  /** Cỡ chữ của chữ cái thay thế. */
  fallbackClassName?: string;
}

/**
 * Ảnh đại diện người dùng, tự chuyển sang chữ cái đầu nếu:
 *  - chưa có ảnh
 *  - ảnh không tải được (file bị xoá, sai đường dẫn…)
 *
 * Nhờ vậy giao diện không bao giờ hiện biểu tượng ảnh hỏng.
 */
export function UserAvatar({ name, avatarUrl, className, fallbackClassName }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);

  // Đổi ảnh khác thì thử tải lại
  useEffect(() => {
    setFailed(false);
  }, [avatarUrl]);

  const showImage = Boolean(avatarUrl) && !failed;

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={buildImageUrl({ path: avatarUrl })}
        alt={name}
        onError={() => setFailed(true)}
        className={cn('rounded-full object-cover', className)}
      />
    );
  }

  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-full bg-sea-100 font-semibold text-sea-700',
        className,
        fallbackClassName,
      )}
      aria-hidden="true"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
