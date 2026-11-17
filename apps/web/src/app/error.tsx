'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Trang lỗi chung khi máy chủ API tạm thời không phản hồi.
 *
 * Trang lỗi không được cache: bản ISR cũ (nếu có) vẫn được phục vụ, và lần tải sau sẽ thử lại.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <h1 className="font-display text-2xl font-bold">Trang tạm thời chưa tải được</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Máy chủ đang bận hoặc vừa khởi động lại. Vui lòng thử lại sau ít phút.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => reset()}>Thử lại</Button>
        <Button variant="outline" asChild>
          <Link href="/">Về trang chủ</Link>
        </Button>
      </div>
    </div>
  );
}
