'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, Eye, MoreHorizontal, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { POST_STATUS_LABELS, POST_TYPE_LABELS, PostStatus, PostType, formatDateTime } from '@phuochai/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/lib/auth/auth-context';
import {
  useAdminPostsQuery,
  useDeletePostMutation,
  usePublishPostMutation,
  useUnpublishPostMutation,
  type AdminPostsQuery,
} from '@/generated/graphql';

type PostRow = AdminPostsQuery['posts']['items'][number];

/** Bảng quản lý bài viết: lọc, sắp xếp, phân trang, thao tác nhanh. */
export function PostsTable() {
  const { canPublish, user, canManageSystem } = useAuth();
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [deleting, setDeleting] = useState<PostRow | null>(null);

  const filter = useMemo(
    () => ({
      page,
      pageSize: 15,
      keyword: keyword.trim() || undefined,
      type: type === 'all' ? undefined : (type as PostType),
      status: status === 'all' ? undefined : (status as PostStatus),
      onlyMine: scope === 'mine' ? true : undefined,
      sortBy: sorting[0]?.id === 'title' ? ('TITLE' as const) : ('CREATED_AT' as const),
      sortOrder: sorting[0]?.desc === false ? ('ASC' as const) : ('DESC' as const),
    }),
    [page, keyword, type, status, scope, sorting],
  );

  const { data, loading, refetch } = useAdminPostsQuery({
    variables: { filter },
    fetchPolicy: 'cache-and-network',
  });

  const [deletePost, { loading: deletingPost }] = useDeletePostMutation();
  const [publishPost] = usePublishPostMutation();
  const [unpublishPost] = useUnpublishPostMutation();

  const posts = data?.posts.items ?? [];
  const totalPages = data?.posts.totalPages ?? 1;

  const columns = useMemo<ColumnDef<PostRow>[]>(
    () => [
      {
        accessorKey: 'title',
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Tiêu đề <ArrowUpDown className="h-3.5 w-3.5" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="max-w-[420px]">
            <Link href={`/quan-tri/bai-viet/${row.original.id}`} className="line-clamp-1 font-medium hover:text-primary">
              {row.original.title}
            </Link>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {row.original.category?.name ?? POST_TYPE_LABELS[row.original.type as PostType]} ·{' '}
              {row.original.ward ?? 'Chưa có xã/phường'}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => (
          <Badge
            variant={
              row.original.status === 'PUBLISHED' ? 'success' : row.original.status === 'DRAFT' ? 'warning' : 'muted'
            }
          >
            {POST_STATUS_LABELS[row.original.status as PostStatus] ?? row.original.status}
          </Badge>
        ),
      },
      {
        accessorKey: 'type',
        header: 'Loại',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {POST_TYPE_LABELS[row.original.type as PostType] ?? row.original.type}
          </span>
        ),
      },
      {
        accessorKey: 'author',
        header: 'Người đăng',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.author?.name ?? '-'}</span>
        ),
      },
      {
        accessorKey: 'updatedAt',
        header: 'Cập nhật',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {formatDateTime(row.original.updatedAt)}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const post = row.original;
          const canEdit = canPublish || post.author?.id === user?.id;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Thao tác">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Thao tác</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/quan-tri/bai-viet/${post.id}`}>
                    <Pencil className="mr-2 h-4 w-4" /> {canEdit ? 'Chỉnh sửa' : 'Xem chi tiết'}
                  </Link>
                </DropdownMenuItem>
                {post.status === 'PUBLISHED' ? (
                  <DropdownMenuItem asChild>
                    <a href={`/luu-tru/${post.slug}`} target="_blank" rel="noreferrer">
                      <Eye className="mr-2 h-4 w-4" /> Xem trên website
                    </a>
                  </DropdownMenuItem>
                ) : null}
                {canPublish ? (
                  post.status === 'PUBLISHED' ? (
                    <DropdownMenuItem
                      onSelect={async () => {
                        await unpublishPost({ variables: { id: post.id } });
                        toast.success('Đã chuyển về bản nháp');
                        void refetch();
                      }}
                    >
                      <Upload className="mr-2 h-4 w-4 rotate-180" /> Chuyển về bản nháp
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onSelect={async () => {
                        await publishPost({ variables: { id: post.id } });
                        toast.success('Đã xuất bản bài viết');
                        void refetch();
                      }}
                    >
                      <Upload className="mr-2 h-4 w-4" /> Xuất bản
                    </DropdownMenuItem>
                  )
                ) : null}
                {canEdit || canManageSystem ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(post)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Xoá bài viết
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [canPublish, canManageSystem, user?.id, publishPost, unpublishPost, refetch],
  );

  const table = useReactTable({
    data: posts,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Quản lý bài viết</h1>
          <p className="text-sm text-muted-foreground">
            {data?.posts.total ?? 0} bài viết · lọc, sửa và xuất bản nội dung.
          </p>
        </div>
        <Button asChild>
          <Link href="/quan-tri/bai-viet/moi">
            <Plus className="mr-2 h-4 w-4" /> Thêm bài viết
          </Link>
        </Button>
      </div>

      <Card className="border-border/70">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo tiêu đề, mô tả, địa chỉ..."
              className="pl-9"
            />
          </div>

          <Select
            value={type}
            onValueChange={(value) => {
              setType(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Loại nội dung" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mọi loại nội dung</SelectItem>
              {Object.entries(POST_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mọi trạng thái</SelectItem>
              {Object.entries(POST_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={scope}
            onValueChange={(value) => {
              setScope(value as 'all' | 'mine');
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả bài viết</SelectItem>
              <SelectItem value="mine">Chỉ bài của tôi</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardContent className="p-0">
          {loading && posts.length === 0 ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Search}
                title="Không tìm thấy bài viết"
                description="Thử đổi từ khoá hoặc bộ lọc khác."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <AlertDialog open={!!deleting} onOpenChange={(open) => (open ? undefined : setDeleting(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá bài viết?</AlertDialogTitle>
            <AlertDialogDescription>
              Bài viết “{deleting?.title}” sẽ bị xoá vĩnh viễn khỏi hệ thống. Hành động này không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingPost}
              onClick={async () => {
                if (!deleting) return;
                try {
                  await deletePost({ variables: { id: deleting.id } });
                  toast.success('Đã xoá bài viết');
                  setDeleting(null);
                  void refetch();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Không xoá được bài viết');
                }
              }}
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
