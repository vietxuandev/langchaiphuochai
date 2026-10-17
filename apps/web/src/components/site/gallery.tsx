'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Expand } from 'lucide-react';
import { buildImageUrl } from '@phuochai/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { PostFullFragment } from '@/generated/graphql';

type GalleryImage = PostFullFragment['images'][number];

/** Thư viện ảnh của bài viết: ảnh lớn + dải thumbnail + xem toàn màn hình. */
export function Gallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[16/9] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-sea-100 to-sea-200 text-sea-600">
        <span className="text-sm">Chưa có ảnh cho địa điểm này</span>
      </div>
    );
  }

  const current = images[Math.min(active, images.length - 1)];
  const currentUrl = buildImageUrl(current);

  return (
    <div className="space-y-3">
      <div className="group relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={currentUrl} alt={current.alt ?? title} className="h-full w-full object-cover" />

        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-3 top-3 opacity-0 transition group-hover:opacity-100"
              aria-label="Xem ảnh lớn"
            >
              <Expand className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl border-none bg-black/95 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentUrl} alt={current.alt ?? title} className="max-h-[80vh] w-full object-contain" />
          </DialogContent>
        </Dialog>

        {images.length > 1 ? (
          <>
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-3 top-1/2 -translate-y-1/2 opacity-0 transition group-hover:opacity-100"
              onClick={() => setActive((active - 1 + images.length) % images.length)}
              aria-label="Ảnh trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 transition group-hover:opacity-100"
              onClick={() => setActive((active + 1) % images.length)}
              aria-label="Ảnh sau"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white">
              {active + 1} / {images.length}
            </span>
          </>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActive(index)}
              className={cn(
                'relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition',
                index === active ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100',
              )}
              aria-label={`Xem ảnh ${index + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={buildImageUrl(image)} alt={image.alt ?? ''} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
