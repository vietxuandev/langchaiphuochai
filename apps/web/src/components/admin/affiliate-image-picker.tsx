'use client';

import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Images, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { UPLOAD, buildImageUrl } from '@phuochai/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchMedia, type MediaItem } from '@/lib/media';
import { uploadImage } from '@/lib/uploads';
import { cn } from '@/lib/utils';

interface AffiliateImagePickerProps {
  value: string;
  onChange: (path: string) => void;
  disabled?: boolean;
}

/** Ảnh sản phẩm affiliate: upload, kéo-thả, chọn thư viện hoặc nhập URL. */
export function AffiliateImagePicker({ value, onChange, disabled = false }: AffiliateImagePickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [mediaQuery, setMediaQuery] = useState('');

  useEffect(() => {
    setPreviewFailed(false);
  }, [value]);

  useEffect(() => {
    if (!libraryOpen) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setMediaLoading(true);
      setMediaError(null);
      fetchMedia({ query: mediaQuery.trim(), pageSize: 24 })
        .then((result) => {
          if (!cancelled) setMedia(result.items);
        })
        .catch((error: unknown) => {
          if (!cancelled) setMediaError(error instanceof Error ? error.message : 'Không tải được thư viện ảnh');
        })
        .finally(() => {
          if (!cancelled) setMediaLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [libraryOpen, mediaQuery]);

  const upload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // Ảnh sản phẩm không đóng watermark thương hiệu.
      const result = await uploadImage(file, 'posts', { watermark: false });
      onChange(result.path);
      toast.success('Đã tải ảnh sản phẩm lên');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không tải được ảnh');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const hasImage = Boolean(value) && !previewFailed;

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={UPLOAD.allowedMimeTypes.join(',')}
        className="hidden"
        disabled={disabled}
        onChange={(event) => void upload(event.target.files)}
      />

      <div
        role="button"
        tabIndex={0}
        aria-label="Khu vực ảnh sản phẩm, kéo thả hoặc bấm để tải ảnh"
        onClick={() => !disabled && fileInputRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !disabled) fileInputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) void upload(event.dataTransfer.files);
        }}
        className={cn(
          'relative flex min-h-36 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-muted/30 p-4 text-center transition',
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/60',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={buildImageUrl({ path: value })}
            alt="Ảnh sản phẩm"
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setPreviewFailed(true)}
          />
        ) : (
          <>
            <ImageIcon className="h-7 w-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">Kéo thả ảnh hoặc bấm để chọn</p>
            <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WEBP, GIF, AVIF - tối đa 10MB</p>
          </>
        )}

        {hasImage ? (
          <div className="absolute inset-x-0 bottom-0 bg-black/55 p-2 text-xs text-white">
            Bấm để đổi ảnh · kéo thả ảnh mới
          </div>
        ) : null}

        {uploading ? (
          <div className="absolute inset-0 grid place-items-center bg-background/75">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled || uploading} onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" /> Tải ảnh lên
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setLibraryOpen(true)}>
          <Images className="mr-2 h-4 w-4" /> Chọn từ thư viện
        </Button>
        {value ? (
          <Button type="button" variant="ghost" size="sm" className="text-destructive" disabled={disabled} onClick={() => onChange('')}>
            <Trash2 className="mr-2 h-4 w-4" /> Xoá ảnh
          </Button>
        ) : null}
      </div>

      <Input
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder="/upload/posts/... hoặc https://..."
        aria-label="Đường dẫn ảnh sản phẩm"
        className="font-mono text-xs"
      />

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chọn ảnh từ thư viện</DialogTitle>
            <DialogDescription>Chọn ảnh đã upload để dùng làm ảnh sản phẩm affiliate.</DialogDescription>
          </DialogHeader>

          <Input
            value={mediaQuery}
            onChange={(event) => setMediaQuery(event.target.value)}
            placeholder="Tìm ảnh theo tên file hoặc đường dẫn..."
            className="max-w-md"
          />

          {mediaLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="aspect-[4/3] rounded-lg" />
              ))}
            </div>
          ) : mediaError ? (
            <p className="py-6 text-center text-sm text-destructive">{mediaError}</p>
          ) : media.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Không tìm thấy ảnh phù hợp.</p>
          ) : (
            <div className="grid max-h-[52vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">
              {media.map((item) => (
                <Button
                  key={item.path}
                  type="button"
                  variant="outline"
                  className="h-auto overflow-hidden p-0 text-left font-normal"
                  onClick={() => {
                    onChange(item.path);
                    setLibraryOpen(false);
                    toast.success('Đã chọn ảnh từ thư viện');
                  }}
                >
                  <span className="block w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.path} alt={item.filename} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                    <span className="block truncate p-2 text-[11px]">{item.filename}</span>
                  </span>
                </Button>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLibraryOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
