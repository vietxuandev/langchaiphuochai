'use client';

import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PostCardImageProps {
  src: string | null;
  alt: string;
  priority?: boolean;
  className?: string;
}

/** Ảnh card có fallback khi file upload bị thiếu/404, tránh khung trắng lớn. */
export function PostCardImage({ src, alt, priority = false, className }: PostCardImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-gradient-to-br from-sea-100 to-sea-200 text-sea-600',
          className,
        )}
        aria-label={`Chưa có ảnh cho ${alt}`}
      >
        <Building2 className="h-10 w-10" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
      className={cn('h-full w-full object-cover transition duration-500 group-hover:scale-105', className)}
    />
  );
}
