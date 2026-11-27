'use client';

import { useState } from 'react';
import { Check, Link2, Share2 } from 'lucide-react';
import { BRAND } from '@phuochai/shared';
import { Button } from '@/components/ui/button';

interface ShareButtonsProps {
  /** Đường dẫn tương đối của bài viết, ví dụ "/luu-tru/oyster-homestay". */
  path: string;
  className?: string;
}

/** Khối chia sẻ bài viết (client component vì cần xử lý sự kiện sao chép). */
export function ShareButtons({ path, className }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  // Luôn dùng domain mới của website khi chạy trên trình duyệt.
  const absoluteUrl =
    typeof window !== 'undefined'
      ? new URL(path, window.location.origin).toString()
      : `${BRAND.siteUrl}${path}`;

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className ?? ''}`}>
      <span className="inline-flex items-center gap-1">
        <Share2 className="h-3.5 w-3.5" />
        Chia sẻ:
      </span>
      <a
        className="hover:text-primary"
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(absoluteUrl)}`}
        target="_blank"
        rel="noreferrer"
      >
        Facebook
      </a>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto gap-1 p-0 text-xs font-normal hover:text-primary"
        onClick={() => void copy()}
      >
        {copied ? <Check className="h-3 w-3 text-sea-600" /> : <Link2 className="h-3 w-3" />}
        {copied ? 'Đã sao chép' : 'Sao chép liên kết'}
      </Button>
    </div>
  );
}
