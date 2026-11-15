'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Copy,
  ExternalLink,
  HardDrive,
  ImageIcon,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { Role, formatDateTime } from '@phuochai/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/lib/auth/auth-context';
import { deleteMedia, fetchMedia, type MediaItem, type MediaPage } from '@/lib/media';
import { uploadImage, type UploadFolder } from '@/lib/uploads';

const FOLDER_LABELS: Record<string, string> = {
  all: 'Tất cả thư mục',
  posts: 'Bài viết',
  categories: 'Danh mục',
  avatars: 'Ảnh đại diện',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaLibrary() {
  const { hasRole } = useAuth();
  const canManage = hasRole(Role.EDITOR);
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<MediaPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('all');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadFolder, setUploadFolder] = useState<UploadFolder>('posts');
  const [pendingDelete, setPendingDelete] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchMedia({ query, folder, page, pageSize: 24 })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được thư viện ảnh');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canManage, query, folder, page, refresh]);

  if (!canManage) {
    return (
      <div className="rounded-xl border border-border bg-background p-8 text-center">
        <p className="font-medium">Bạn không có quyền truy cập thư viện ảnh.</p>
        <p className="mt-1 text-sm text-muted-foreground">Cần vai trò Biên tập viên trở lên.</p>
      </div>
    );
  }

  const items = data?.items ?? [];
  const totalFiles = data?.totalFiles ?? 0;
  const totalBytes = data?.totalBytes ?? 0;

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    let uploaded = 0;

    for (const file of Array.from(files)) {
      try {
        await uploadImage(file, uploadFolder);
        uploaded += 1;
      } catch (err) {
        toast.error(`${file.name}: ${err instanceof Error ? err.message : 'Tải ảnh thất bại'}`);
      }
    }

    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
    if (uploaded > 0) {
      toast.success(`Đã tải lên ${uploaded} ảnh`);
      setPage(1);
      setRefresh((value) => value + 1);
    }
  };

  const handleCopy = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      toast.success('Đã copy đường dẫn ảnh');
    } catch {
      toast.error('Trình duyệt không cho phép copy');
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteMedia(pendingDelete.path);
      toast.success('Đã xoá ảnh');
      setPendingDelete(null);
      setRefresh((value) => value + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xoá ảnh thất bại');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Thư viện ảnh</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý ảnh đã upload, kiểm tra ảnh đang được dùng và copy đường dẫn nhanh.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={uploadFolder} onValueChange={(value) => setUploadFolder(value as UploadFolder)}>
            <SelectTrigger className="w-36" aria-label="Thư mục upload">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="posts">Bài viết</SelectItem>
              <SelectItem value="categories">Danh mục</SelectItem>
              <SelectItem value="avatars">Ảnh đại diện</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => inputRef.current?.click()} disabled={uploading}>
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? 'Đang tải...' : 'Tải ảnh lên'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            multiple
            className="hidden"
            onChange={(event) => void handleUpload(event.target.files)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tổng số ảnh</p>
              <p className="font-display text-xl font-semibold">{totalFiles}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dung lượng</p>
              <p className="font-display text-xl font-semibold">{formatBytes(totalBytes)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="text-xs text-muted-foreground">Trang hiện tại</p>
              <p className="font-display text-xl font-semibold">
                {data?.page ?? 1}
                <span className="text-sm font-normal text-muted-foreground"> / {data?.totalPages ?? 1}</span>
              </p>
            </div>
            <Button variant="outline" size="icon" onClick={() => setRefresh((value) => value + 1)} aria-label="Làm mới">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tên file hoặc đường dẫn..."
              className="pl-9"
            />
          </div>
          <Select
            value={folder}
            onValueChange={(value) => {
              setFolder(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-48" aria-label="Lọc thư mục">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(FOLDER_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="font-medium text-destructive">{error}</p>
            <Button variant="outline" className="mt-3" onClick={() => setRefresh((value) => value + 1)}>
              Thử lại
            </Button>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="Chưa có ảnh nào"
          description={query ? 'Không tìm thấy ảnh phù hợp.' : 'Tải ảnh đầu tiên lên thư viện.'}
          action={
            <Button onClick={() => inputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Tải ảnh lên
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {items.map((item) => {
              const used = item.usage.total > 0;
              return (
                <Card key={item.path} className="overflow-hidden border-border/70">
                  <div className="relative aspect-[4/3] bg-muted">
                    {/* Ảnh do server nội bộ phục vụ tại /upload/... */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.path}
                      alt={item.filename}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    <Badge
                      variant={used ? 'warning' : 'muted'}
                      className="absolute left-2 top-2 shadow-sm"
                      title={
                        used
                          ? `Bài viết: ${item.usage.posts}, danh mục: ${item.usage.categories}, người dùng: ${item.usage.users}`
                          : 'Chưa được sử dụng'
                      }
                    >
                      {used ? 'Đang dùng' : 'Chưa dùng'}
                    </Badge>
                  </div>
                  <CardContent className="space-y-3 p-4">
                    <div>
                      <p className="truncate text-sm font-medium" title={item.filename}>
                        {item.filename}
                      </p>
                      <p className="truncate text-xs text-muted-foreground" title={item.path}>
                        {item.path}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatBytes(item.bytes)}</span>
                      <span>{formatDateTime(item.modifiedAt)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => void handleCopy(item.path)}
                      >
                        <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                      </Button>
                      <Button variant="outline" size="icon" asChild title="Mở ảnh">
                        <Link href={item.path} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        disabled={used}
                        title={used ? 'Ảnh đang được sử dụng, không thể xoá' : 'Xoá ảnh'}
                        onClick={() => setPendingDelete(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Pagination page={data?.page ?? 1} totalPages={data?.totalPages ?? 1} onPageChange={setPage} />
        </>
      )}

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá ảnh này?</AlertDialogTitle>
            <AlertDialogDescription>
              Ảnh <strong>{pendingDelete?.filename}</strong> sẽ bị xoá khỏi server. Chỉ nên xoá ảnh chưa
              được sử dụng.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Đang xoá...' : 'Xoá ảnh'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
