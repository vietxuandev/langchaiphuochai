'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  ROLE_LABELS,
  Role,
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type UpdateProfileInput,
} from '@phuochai/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUploadField } from '@/components/ui/image-upload-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth/auth-context';
import { useChangePasswordMutation, useUpdateProfileMutation } from '@/generated/graphql';

/** Trang tài khoản: cập nhật hồ sơ và đổi mật khẩu. */
export function AccountSettings() {
  const { user, refresh } = useAuth();
  const [updateProfile, { loading: savingProfile }] = useUpdateProfileMutation();
  const [changePassword, { loading: savingPassword }] = useChangePasswordMutation();

  const profileForm = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema) as never,
    defaultValues: {
      name: user?.name ?? '',
      avatarUrl: user?.avatarUrl ?? '',
      bio: user?.bio ?? '',
      phone: user?.phone ?? '',
    },
  });

  /**
   * Nếu `user` được nạp sau khi form đã mount (ví dụ mở trang khi phiên đang khôi phục),
   * đồng bộ lại giá trị để ảnh đại diện và hồ sơ không bị trống.
   */
  useEffect(() => {
    if (!user || profileForm.formState.isDirty) return;
    profileForm.reset({
      name: user.name ?? '',
      avatarUrl: user.avatarUrl ?? '',
      bio: user.bio ?? '',
      phone: user.phone ?? '',
    });
  }, [user, profileForm]);

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema) as never,
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSaveProfile = profileForm.handleSubmit(async (values) => {
    try {
      await updateProfile({ variables: { input: values } });
      await refresh();
      toast.success('Đã cập nhật hồ sơ');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không lưu được hồ sơ');
    }
  });

  const onChangePassword = passwordForm.handleSubmit(async (values) => {
    try {
      await changePassword({ variables: { input: values } });
      passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Đã đổi mật khẩu');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không đổi được mật khẩu');
    }
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-bold">Tài khoản của tôi</h1>
        <p className="text-sm text-muted-foreground">Cập nhật thông tin cá nhân và mật khẩu đăng nhập.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="font-display text-base">Hồ sơ cá nhân</CardTitle>
            <CardDescription>Thông tin này hiển thị công khai ở phần tác giả bài viết.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSaveProfile} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profile-name">Họ và tên</Label>
                  <Input id="profile-name" {...profileForm.register('name')} />
                  {profileForm.formState.errors.name ? (
                    <p className="text-xs text-destructive">{profileForm.formState.errors.name.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-phone">Số điện thoại</Label>
                  <Input id="profile-phone" {...profileForm.register('phone')} />
                </div>
              </div>

              <ImageUploadField
                label="Ảnh đại diện"
                hint="Ảnh này hiển thị cạnh tên bạn ở phần tác giả bài viết."
                folder="avatars"
                aspect="square"
                value={profileForm.watch('avatarUrl') ?? ''}
                onChange={(path) => profileForm.setValue('avatarUrl', path, { shouldDirty: true })}
              />

              <div className="space-y-2">
                <Label htmlFor="profile-bio">Giới thiệu ngắn</Label>
                <Textarea id="profile-bio" rows={3} {...profileForm.register('bio')} />
              </div>

              <Button type="submit" disabled={savingProfile}>
                <Save className="mr-2 h-4 w-4" /> Lưu hồ sơ
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="font-display text-base">Thông tin tài khoản</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{user?.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Vai trò</span>
                <Badge variant="secondary">{ROLE_LABELS[(user?.role as Role) ?? Role.USER]}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Số bài viết</span>
                <span className="font-medium">{user?.postCount ?? 0}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <KeyRound className="h-4 w-4" /> Đổi mật khẩu
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Mật khẩu hiện tại</Label>
                  <Input id="current-password" type="password" {...passwordForm.register('currentPassword')} />
                  {passwordForm.formState.errors.currentPassword ? (
                    <p className="text-xs text-destructive">
                      {passwordForm.formState.errors.currentPassword.message}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Mật khẩu mới</Label>
                  <Input id="new-password" type="password" {...passwordForm.register('newPassword')} />
                  {passwordForm.formState.errors.newPassword ? (
                    <p className="text-xs text-destructive">{passwordForm.formState.errors.newPassword.message}</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">Nhập lại mật khẩu mới</Label>
                  <Input id="confirm-new-password" type="password" {...passwordForm.register('confirmPassword')} />
                  {passwordForm.formState.errors.confirmPassword ? (
                    <p className="text-xs text-destructive">
                      {passwordForm.formState.errors.confirmPassword.message}
                    </p>
                  ) : null}
                </div>
                <Button type="submit" variant="outline" className="w-full" disabled={savingPassword}>
                  Đổi mật khẩu
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
