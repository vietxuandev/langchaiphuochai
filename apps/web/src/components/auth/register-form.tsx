'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, MailCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { registerSchema, type RegisterInput } from '@phuochai/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth/auth-context';

/** Form đăng ký thành viên mới (mặc định vai trò USER). */
export function RegisterForm() {
  const { register: registerUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  /** Thông báo sau khi đăng ký: tài khoản chờ quản trị viên duyệt. */
  const [submitted, setSubmitted] = useState<{ email: string; message: string } | null>(null);

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
      const result = await registerUser(values.name, values.email, values.password);
      setSubmitted({ email: values.email, message: result.message });
      toast.success('Đăng ký thành công - vui lòng chờ quản trị viên duyệt');
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
          Sau khi đăng ký, tài khoản sẽ ở trạng thái <strong>chờ duyệt</strong>. Quản trị viên duyệt và cấp quyền thì
          bạn mới đăng nhập được.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {submitted ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="space-y-1">
                <p className="font-medium text-emerald-900 dark:text-emerald-200">Đã gửi yêu cầu đăng ký</p>
                <p className="text-emerald-800/90 dark:text-emerald-200/80">
                  Tài khoản <strong>{submitted.email}</strong> đang chờ quản trị viên duyệt và cấp quyền. Bạn sẽ đăng nhập
                  được ngay sau khi được duyệt.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <MailCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Nếu cần gấp, vui lòng liên hệ quản trị viên website để được duyệt sớm.
            </div>
            <Button asChild className="w-full" variant="outline">
              <Link href="/dang-nhap">Về trang đăng nhập</Link>
            </Button>
          </div>
        ) : (
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
        )}

        {!submitted ? (
        <p className="mt-5 text-center text-sm text-muted-foreground">
          Đã có tài khoản?{' '}
          <Link href="/dang-nhap" className="font-medium text-primary hover:underline">
            Đăng nhập
          </Link>
        </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
