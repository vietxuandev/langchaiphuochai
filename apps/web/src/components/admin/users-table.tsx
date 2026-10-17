'use client';

import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MoreHorizontal, Plus, Search, ShieldAlert, UserCog, UserX } from 'lucide-react';
import { toast } from 'sonner';
import {
  ROLE_LABELS,
  Role,
  adminCreateUserSchema,
  formatDateTime,
  type AdminCreateUserInput,
} from '@phuochai/shared';
import { UserAvatar } from '@/components/ui/user-avatar';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/lib/auth/auth-context';
import {
  useAdminUsersQuery,
  useCreateUserMutation,
  useDeactivateUserMutation,
  useUpdateUserMutation,
  type AdminUsersQuery,
} from '@/generated/graphql';

type UserRow = AdminUsersQuery['users']['items'][number];

const ROLE_VARIANT: Record<string, 'default' | 'secondary' | 'muted'> = {
  ADMIN: 'default',
  EDITOR: 'secondary',
  USER: 'muted',
};

/** Bảng quản lý người dùng & phân quyền (chỉ quản trị viên). */
export function UsersTable() {
  const { canManageSystem, user: currentUser } = useAuth();
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [role, setRole] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, loading, refetch } = useAdminUsersQuery({
    variables: {
      keyword: keyword.trim() || undefined,
      role: role === 'all' ? undefined : (role as Role),
      page,
      pageSize: 15,
    },
    fetchPolicy: 'cache-and-network',
    skip: !canManageSystem,
  });

  const [createUser] = useCreateUserMutation();
  const [updateUser] = useUpdateUserMutation();
  const [deactivateUser] = useDeactivateUserMutation();

  const form = useForm<AdminCreateUserInput>({
    resolver: zodResolver(adminCreateUserSchema) as never,
    defaultValues: { name: '', email: '', password: '', role: Role.USER },
  });

  const users = data?.users.items ?? [];
  const totalPages = data?.users.totalPages ?? 1;

  const columns = useMemo<ColumnDef<UserRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Người dùng',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <UserAvatar name={row.original.name} avatarUrl={row.original.avatarUrl} className="h-9 w-9 text-sm" />
            <div className="min-w-0">
              <p className="truncate font-medium">{row.original.name}</p>
              <p className="truncate text-xs text-muted-foreground">{row.original.email}</p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'role',
        header: 'Vai trò',
        cell: ({ row }) => (
          <Badge variant={ROLE_VARIANT[row.original.role] ?? 'muted'}>
            {ROLE_LABELS[row.original.role as Role] ?? row.original.role}
          </Badge>
        ),
      },
      {
        accessorKey: 'isActive',
        header: 'Trạng thái',
        cell: ({ row }) =>
          row.original.isActive ? <Badge variant="success">Hoạt động</Badge> : <Badge variant="destructive">Đã khoá</Badge>,
      },
      {
        accessorKey: 'postCount',
        header: 'Bài viết',
        cell: ({ row }) => <span className="text-sm">{row.original.postCount ?? 0}</span>,
      },
      {
        accessorKey: 'lastLoginAt',
        header: 'Đăng nhập gần nhất',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.lastLoginAt ? formatDateTime(row.original.lastLoginAt) : 'Chưa đăng nhập'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const isSelf = row.original.id === currentUser?.id;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Thao tác" disabled={isSelf}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Đổi vai trò</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <DropdownMenuItem
                    key={value}
                    disabled={row.original.role === value}
                    onSelect={async () => {
                      try {
                        await updateUser({ variables: { input: { id: row.original.id, role: value as Role } } });
                        toast.success(`Đã đổi vai trò thành ${label}`);
                        void refetch();
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : 'Không đổi được vai trò');
                      }
                    }}
                  >
                    <UserCog className="mr-2 h-4 w-4" /> {label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  disabled={!row.original.isActive}
                  onSelect={async () => {
                    try {
                      await deactivateUser({ variables: { id: row.original.id } });
                      toast.success('Đã vô hiệu hoá tài khoản');
                      void refetch();
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'Không vô hiệu hoá được');
                    }
                  }}
                >
                  <UserX className="mr-2 h-4 w-4" /> Vô hiệu hoá
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [currentUser?.id, updateUser, deactivateUser, refetch],
  );

  const table = useReactTable({ data: users, columns, getCoreRowModel: getCoreRowModel() });

  if (!canManageSystem) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Không có quyền truy cập"
        description="Chỉ quản trị viên mới có thể quản lý người dùng và phân quyền."
      />
    );
  }

  const onCreate = form.handleSubmit(async (values) => {
    try {
      await createUser({ variables: { input: values } });
      toast.success('Đã tạo người dùng mới');
      setDialogOpen(false);
      form.reset({ name: '', email: '', password: '', role: Role.USER });
      void refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không tạo được người dùng');
    }
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">Người dùng &amp; phân quyền</h1>
          <p className="text-sm text-muted-foreground">
            {data?.users.total ?? 0} tài khoản - quản trị viên, người đăng bài và thành viên.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Thêm người dùng
        </Button>
      </div>

      <Card className="border-border/70">
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo tên hoặc email..."
              className="pl-9"
            />
          </div>
          <Select
            value={role}
            onValueChange={(value) => {
              setRole(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Vai trò" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mọi vai trò</SelectItem>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardContent className="p-0">
          {loading && users.length === 0 ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-14 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="p-8">
              <EmptyState icon={UserCog} title="Không tìm thấy người dùng" description="Thử từ khoá khác." />
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm người dùng</DialogTitle>
            <DialogDescription>Tạo tài khoản với vai trò phù hợp. Mật khẩu có thể đổi sau.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Họ và tên</Label>
              <Input id="user-name" {...form.register('name')} />
              {form.formState.errors.name ? (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input id="user-email" type="email" {...form.register('email')} />
              {form.formState.errors.email ? (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="user-password">Mật khẩu</Label>
                <Input id="user-password" type="password" {...form.register('password')} />
                {form.formState.errors.password ? (
                  <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>Vai trò</Label>
                <Select
                  value={form.watch('role')}
                  onValueChange={(value) => form.setValue('role', value as Role)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Huỷ
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                Tạo tài khoản
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
