'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { loginSchema, type LoginInput } from '@phuochai/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth/auth-context';

/** Form đăng nhập: react-hook-form + zod (dùng chung schema với backend). */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const user = await login(values.email, values.password);
      toast.success(`Xin chào ${user.name}!`);
      const redirect = searchParams.get('tiep-theo');
      router.push(redirect && redirect.startsWith('/') ? redirect : '/quan-tri');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Đăng nhập thất bại');
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Card className="border-border/70 shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-2xl">Đăng nhập</CardTitle>
        <CardDescription>Truy cập bảng điều khiển quản trị nội dung Phước Hải.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="ban@langchaiphuochai.com" autoComplete="email" {...register('email')} />
            {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
            {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            <LogIn className="mr-2 h-4 w-4" />
            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Chưa có tài khoản?{' '}
          <Link href="/dang-ky" className="font-medium text-primary hover:underline">
            Đăng ký ngay
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
