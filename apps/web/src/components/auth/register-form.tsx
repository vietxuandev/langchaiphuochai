'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { registerSchema, type RegisterInput } from '@phuochai/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth/auth-context';

/** Form đăng ký thành viên mới (mặc định vai trò USER). */
export function RegisterForm() {
  const router = useRouter();
  const { register: registerUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const user = await registerUser(values.name, values.email, values.password);
      toast.success(`Tạo tài khoản thành công. Xin chào ${user.name}!`);
      router.push('/quan-tri');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Đăng ký thất bại');
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-2xl">Đăng ký tài khoản</CardTitle>
        <CardDescription>
          Tài khoản thành viên có thể tạo bản nháp bài viết và quản lý hồ sơ cá nhân.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Họ và tên</Label>
            <Input id="name" placeholder="Nguyễn Văn A" {...register('name')} />
            {errors.name ? <p className="text-xs text-destructive">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="ban@langchaiphuochai.com" autoComplete="email" {...register('email')} />
            {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
              {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Nhập lại mật khẩu</Label>
              <Input id="confirmPassword" type="password" autoComplete="new-password" {...register('confirmPassword')} />
              {errors.confirmPassword ? (
                <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
              ) : null}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            <UserPlus className="mr-2 h-4 w-4" />
            {submitting ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Đã có tài khoản?{' '}
          <Link href="/dang-nhap" className="font-medium text-primary hover:underline">
            Đăng nhập
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
