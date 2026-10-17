'use client';

import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { FolderTree, MoreHorizontal, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { POST_TYPE_LABELS, PostType, categoryInputSchema, type CategoryInput } from '@phuochai/shared';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { ImageUploadField } from '@/components/ui/image-upload-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth/auth-context';
import {
  useAdminCategoriesQuery,
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
  useUpdateCategoryMutation,
  type AdminCategoriesQuery,
} from '@/generated/graphql';

type CategoryRow = AdminCategoriesQuery['categories'][number];

/** Bảng quản lý danh mục (chỉ quản trị viên) kèm dialog thêm/sửa. */
export function CategoriesTable() {
  const { canManageSystem } = useAuth();
  const { data, loading, refetch } = useAdminCategoriesQuery({ fetchPolicy: 'cache-and-network' });
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);

  const [createCategory] = useCreateCategoryMutation();
  const [updateCategory] = useUpdateCategoryMutation();
  const [deleteCategory] = useDeleteCategoryMutation();

  const categories = data?.categories ?? [];

  const form = useForm<CategoryInput>({
    resolver: zodResolver(categoryInputSchema) as never,
    defaultValues: { name: '', section: PostType.ACCOMMODATION, sortOrder: 0 },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({ name: '', section: PostType.ACCOMMODATION, sortOrder: 0 });
    setDialogOpen(true);
  };

  const openEdit = (category: CategoryRow) => {
    setEditing(category);
    form.reset({
      name: category.name,
      slug: category.slug,
      section: category.section as PostType,
      description: category.description ?? '',
      seoTitle: category.seoTitle ?? '',
      imagePath: category.imagePath ?? '',
      parentId: category.parentId ?? '',
      sortOrder: category.sortOrder,
    });
    setDialogOpen(true);
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (editing) {
        await updateCategory({ variables: { input: { ...values, id: editing.id } } });
        toast.success('Đã cập nhật danh mục');
      } else {
        await createCategory({ variables: { input: values } });
        toast.success('Đã tạo danh mục');
      }
      setDialogOpen(false);
      void refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không lưu được danh mục');
    }
  });

  const columns = useMemo<ColumnDef<CategoryRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Danh mục',
        cell: ({ row }) => (
          <div>
            <p className="font-medium">
              {row.original.parentId ? <span className="text-muted-foreground">- </span> : null}
              {row.original.name}
            </p>
            <p className="font-mono text-xs text-muted-foreground">/{row.original.slug}</p>
          </div>
        ),
      },
      {
        accessorKey: 'section',
        header: 'Loại nội dung',
        cell: ({ row }) => (
          <Badge variant="muted">{POST_TYPE_LABELS[row.original.section as PostType] ?? row.original.section}</Badge>
        ),
      },
      {
        accessorKey: 'postCount',
        header: 'Số bài viết',
        cell: ({ row }) => <span className="text-sm">{row.original.postCount}</span>,
      },
      {
        accessorKey: 'level',
        header: 'Cấp',
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.level}</span>,
      },
      {
        accessorKey: 'isLocationFilter',
        header: 'Lọc theo tỉnh',
        cell: ({ row }) =>
          row.original.isLocationFilter ? <Badge variant="warning">Có</Badge> : <span className="text-muted-foreground">-</span>,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Thao tác">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => openEdit(row.original)}>
                <Pencil className="mr-2 h-4 w-4" /> Chỉnh sửa
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(row.original)}>
                <Trash2 className="mr-2 h-4 w-4" /> Xoá
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const table = useReactTable({
    data: categories,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!canManageSystem) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Không có quyền truy cập"
        description="Chỉ quản trị viên mới có thể quản lý danh mục."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Quản lý danh mục</h1>
          <p className="text-sm text-muted-foreground">
            {categories.length} danh mục - bao gồm danh mục gốc, danh mục con và trang lọc theo tỉnh/thành.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Thêm danh mục
        </Button>
      </div>

      <Card className="border-border/70">
        <CardContent className="p-0">
          {loading && categories.length === 0 ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="p-8">
              <EmptyState icon={FolderTree} title="Chưa có danh mục" description="Hãy import dữ liệu hoặc tạo danh mục mới." />
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}</DialogTitle>
            <DialogDescription>
              Danh mục dùng để phân loại bài viết và hiển thị trên menu điều hướng.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category-name">Tên danh mục *</Label>
                <Input id="category-name" {...form.register('name')} />
                {form.formState.errors.name ? (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-slug">Slug</Label>
                <Input id="category-slug" placeholder="Tự sinh từ tên" {...form.register('slug')} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Loại nội dung *</Label>
                <Select
                  value={form.watch('section')}
                  onValueChange={(value) => form.setValue('section', value as PostType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(POST_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Danh mục cha</Label>
                <Select
                  value={form.watch('parentId') || 'none'}
                  onValueChange={(value) => form.setValue('parentId', value === 'none' ? '' : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Không có" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Không có (danh mục gốc)</SelectItem>
                    {categories
                      .filter((category) => category.id !== editing?.id && category.level === 0)
                      .map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-order">Thứ tự</Label>
                <Input id="category-order" type="number" {...form.register('sortOrder')} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-description">Mô tả</Label>
              <Textarea id="category-description" rows={2} {...form.register('description')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-seo">Tiêu đề SEO</Label>
              <Input id="category-seo" {...form.register('seoTitle')} />
            </div>

            <ImageUploadField
              label="Ảnh đại diện danh mục"
              hint="Ảnh hiển thị ở đầu trang danh mục và trong menu (tuỳ chọn)."
              folder="categories"
              value={form.watch('imagePath') ?? ''}
              onChange={(path) => form.setValue('imagePath', path, { shouldDirty: true })}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Huỷ
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {editing ? 'Lưu thay đổi' : 'Tạo danh mục'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(open) => (open ? undefined : setDeleting(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá danh mục “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Chỉ xoá được danh mục không còn danh mục con và không còn bài viết nào.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                try {
                  await deleteCategory({ variables: { id: deleting.id } });
                  toast.success('Đã xoá danh mục');
                  setDeleting(null);
                  void refetch();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Không xoá được danh mục');
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
