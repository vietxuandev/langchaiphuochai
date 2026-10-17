'use client';

import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { UPLOAD, buildImageUrl } from '@phuochai/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { uploadImage, type UploadFolder } from '@/lib/uploads';
import { cn } from '@/lib/utils';

interface ImageUploadFieldProps {
  /** Đường dẫn ảnh hiện tại trên máy chủ mới (/upload/...) - rỗng nghĩa là chưa có ảnh. */
  value: string | null | undefined;
  /** Nhận đường dẫn mới sau khi upload, hoặc chuỗi rỗng khi xoá ảnh. */
  onChange: (path: string) => void;
  /** Thư mục con trong `upload/` (posts | categories | avatars). */
  folder?: UploadFolder;
  label?: string;
  hint?: string;
  /** Tỉ lệ khung xem trước. */
  aspect?: 'square' | 'wide';
  className?: string;
  disabled?: boolean;
}

/**
 * Ô chọn ảnh dùng chung cho mọi form có field ảnh.
 *
 * Người dùng chỉ cần bấm **Tải ảnh lên** để chọn file từ máy - ảnh được gửi tới API mới
 * và lưu trong thư mục `upload/` của máy chủ. Vẫn có tuỳ chọn nhập đường dẫn thủ công
 * cho người rành kỹ thuật.
 */
export function ImageUploadField({
  value,
  onChange,
  folder = UPLOAD.postsFolder,
  label,
  hint,
  aspect = 'wide',
  className,
  disabled = false,
}: ImageUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const hasImage = Boolean(value && value.trim()) && !previewFailed;

  // Đổi ảnh thì thử tải lại ảnh xem trước
  useEffect(() => {
    setPreviewFailed(false);
  }, [value]);

  const handleFiles = async (files: FileList | null): Promise<void> => {
    if (!files?.length) return;
    const file = files[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await uploadImage(file, folder);
      onChange(result.path);
      toast.success('Đã tải ảnh lên máy chủ');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không tải được ảnh');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label ? <Label>{label}</Label> : null}

      <div className="flex flex-wrap items-start gap-4">
        {/* Khung xem trước */}
        <div
          className={cn(
            'relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/40',
            aspect === 'square' ? 'h-28 w-28' : 'h-28 w-44',
          )}
        >
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={buildImageUrl({ path: value })}
              alt="Ảnh xem trước"
              onError={() => setPreviewFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <ImageIcon className="h-5 w-5" />
              <span className="text-[11px]">Chưa có ảnh</span>
            </div>
          )}

          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : null}
        </div>

        {/* Nút thao tác */}
        <div className="min-w-[220px] flex-1 space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            accept={UPLOAD.allowedMimeTypes.join(',')}
            className="hidden"
            onChange={(event) => {
              void handleFiles(event.target.files);
              event.target.value = '';
            }}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={hasImage ? 'outline' : 'default'}
              size="sm"
              disabled={disabled || uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {uploading ? 'Đang tải...' : hasImage ? 'Đổi ảnh khác' : 'Tải ảnh lên'}
            </Button>

            {hasImage ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                disabled={disabled || uploading}
                onClick={() => {
                  onChange('');
                  toast.success('Đã bỏ ảnh khỏi bài viết');
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Xoá ảnh
              </Button>
            ) : null}

            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-8 px-1 text-xs"
              onClick={() => setShowManual((current) => !current)}
            >
              {showManual ? 'Ẩn nhập đường dẫn' : 'Nhập đường dẫn thủ công'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {hint ??
              `Ảnh được lưu trong thư mục upload/ của máy chủ (JPG, PNG, WEBP, GIF, AVIF - tối đa ${Math.round(
                UPLOAD.maxBytes / 1024 / 1024,
              )}MB).`}
          </p>

          {showManual ? (
            <Input
              value={value ?? ''}
              placeholder={`/upload/${folder}/2026/10/anh.jpg`}
              disabled={disabled}
              onChange={(event) => onChange(event.target.value)}
              className="font-mono text-xs"
            />
          ) : hasImage ? (
            <p className="truncate font-mono text-[11px] text-muted-foreground">{value}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
