'use client';

import { useEffect } from 'react';

interface ViewTrackerProps {
  slug: string;
}

/**
 * Tăng lượt xem sau khi trang đã tải.
 *
 * Nhờ vậy trang chi tiết không cần mutation trên server và có thể được
 * render tĩnh/ISR mà vẫn đếm được lượt xem.
 */
export function ViewTracker({ slug }: ViewTrackerProps) {
  useEffect(() => {
    const key = `viewed:${slug}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // Trình duyệt chặn storage: vẫn thử ghi nhận một lần.
    }

    const controller = new AbortController();
    void fetch('/api/views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug }),
      keepalive: true,
      signal: controller.signal,
    }).catch(() => undefined);

    return () => controller.abort();
  }, [slug]);

  return null;
}
