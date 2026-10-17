import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export const metadata: Metadata = {
  title: 'Đăng nhập',
  description: 'Đăng nhập vào hệ thống quản trị nội dung Phước Hải.',
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingSpinner className="mx-auto" label="Đang tải form đăng nhập" />}>
      <LoginForm />
    </Suspense>
  );
}
