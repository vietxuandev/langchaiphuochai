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
import { CheckCircle2, MoreHorizontal, Plus, Search, ShieldAlert, Trash2, UserCog, UserX, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  ROLE_LABELS,
  Role,
  adminCreateUserSchema,
  formatDateTime,
  type AdminCreateUserInput,
  UserStatus,
  USER_STATUS_LABELS,
} from '@phuochai/shared';
import { UserAvatar } from '@/components/ui/user-avatar';
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
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/lib/auth/auth-context';
import {
  useAdminUsersQuery,
  useApproveUserMutation,
  useCreateUserMutation,
  useDeactivateUserMutation,
  useRejectUserMutation,
  useRemoveUserMutation,
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
  const [status, setStatus] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<UserRow | null>(null);
  const [approveRole, setApproveRole] = useState<Role>(Role.USER);
  const [rejectTarget, setRejectTarget] = useState<UserRow | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const { data, loading, refetch } = useAdminUsersQuery({
    variables: {
      keyword: keyword.trim() || undefined,
      role: role === 'all' ? undefined : (role as Role),
      status: status === 'all' ? undefined : (status as UserStatus),
      page,
      pageSize: 15,
    },
    fetchPolicy: 'cache-and-network',
    skip: !canManageSystem,
  });

  const [createUser] = useCreateUserMutation();
  const [updateUser] = useUpdateUserMutation();
  const [deactivateUser] = useDeactivateUserMutation();
  const [approveUser, { loading: approving }] = useApproveUserMutation();
  const [rejectUser, { loading: rejecting }] = useRejectUserMutation();
  const [removeUser, { loading: removing }] = useRemoveUserMutation();
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

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
        accessorKey: 'status',
        header: 'Trạng thái',
        cell: ({ row }) => {
          if (row.original.status === UserStatus.PENDING) {
            return <Badge variant="warning">Chờ duyệt</Badge>;
          }
          if (row.original.status === UserStatus.REJECTED) {
            return <Badge variant="destructive">Bị từ chối</Badge>;
          }
          return row.original.isActive ? (
            <Badge variant="success">Hoạt động</Badge>
          ) : (
            <Badge variant="destructive">Đã khoá</Badge>
          );
        },
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
                {row.original.status === UserStatus.PENDING ? (
                  <>
                    <DropdownMenuLabel>Tài khoản chờ duyệt</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => {
                        setApproveTarget(row.original);
                        setApproveRole(row.original.role as Role);
                      }}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Duyệt và cấp quyền
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onSelect={() => {
                        setRejectTarget(row.original);
                        setRejectNote('');
                      }}
                    >
                      <XCircle className="mr-2 h-4 w-4" /> Từ chối
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                ) : null}
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
                  onSelect={() => setDeleteTarget(row.original)}
                  disabled={row.original.role === Role.ADMIN || (row.original.postCount ?? 0) > 0}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Xoá tài khoản
                </DropdownMenuItem>
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

  const handleApprove = async () => {
    if (!approveTarget) return;
    try {
      await approveUser({ variables: { id: approveTarget.id, role: approveRole } });
      toast.success(`Đã duyệt ${approveTarget.email} với vai trò ${ROLE_LABELS[approveRole]}`);
      setApproveTarget(null);
      void refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không duyệt được tài khoản');
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    try {
      await rejectUser({ variables: { id: rejectTarget.id, note: rejectNote || undefined } });
      toast.success(`Đã từ chối ${rejectTarget.email}`);
      setRejectTarget(null);
      void refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không từ chối được tài khoản');
    }
  };

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
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Mọi trạng thái</SelectItem>
              {Object.entries(USER_STATUS_LABELS).map(([value, label]) => (
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

      {/* Duyệt tài khoản: chọn vai trò rồi xác nhận */}
      <Dialog open={Boolean(approveTarget)} onOpenChange={(open) => (open ? undefined : setApproveTarget(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duyệt tài khoản</DialogTitle>
            <DialogDescription>
              Duyệt <strong>{approveTarget?.name}</strong> ({approveTarget?.email}) và cấp quyền truy cập.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Vai trò</Label>
            <Select value={approveRole} onValueChange={(value) => setApproveRole(value as Role)}>
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
            <p className="text-xs text-muted-foreground">
              Sau khi duyệt, người dùng đăng nhập được ngay bằng email và mật khẩu đã đăng ký.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setApproveTarget(null)}>
              Huỷ
            </Button>
            <Button type="button" onClick={handleApprove} disabled={approving}>
              {approving ? 'Đang duyệt...' : 'Duyệt tài khoản'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Xoá tài khoản rác / bị từ chối (không có bài viết) */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => (open ? undefined : setDeleteTarget(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá tài khoản?</AlertDialogTitle>
            <AlertDialogDescription>
              Tài khoản <strong>{deleteTarget?.email}</strong> sẽ bị xoá vĩnh viễn khỏi hệ thống. Chỉ xoá được tài khoản
              không phải quản trị viên và chưa có bài viết.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removing}
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await removeUser({ variables: { id: deleteTarget.id } });
                  toast.success(`Đã xoá ${deleteTarget.email}`);
                  setDeleteTarget(null);
                  void refetch();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Không xoá được tài khoản');
                }
              }}
            >
              {removing ? 'Đang xoá...' : 'Xoá tài khoản'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Từ chối tài khoản: ghi lý do (không bắt buộc) */}
      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => (open ? undefined : setRejectTarget(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Từ chối tài khoản</DialogTitle>
            <DialogDescription>
              Tài khoản <strong>{rejectTarget?.email}</strong> sẽ không đăng nhập được.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-note">Lý do (không bắt buộc)</Label>
            <Textarea
              id="reject-note"
              value={rejectNote}
              onChange={(event) => setRejectNote(event.target.value)}
              rows={3}
              placeholder="Ví dụ: không đúng thông tin liên hệ..."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>
              Huỷ
            </Button>
            <Button type="button" variant="destructive" onClick={handleReject} disabled={rejecting}>
              {rejecting ? 'Đang xử lý...' : 'Từ chối'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
