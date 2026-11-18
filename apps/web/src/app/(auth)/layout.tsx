import Link from 'next/link';
import { BRAND } from '@phuochai/shared';
import { BrandLogo } from '@/components/site/brand-logo';

/** Layout cho trang đăng nhập / đăng ký: tối giản, tập trung vào form. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-hero-gradient p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-16 top-1/3 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <Link href="/">
          <BrandLogo className="h-12 w-12" withName inverted subtitle={BRAND.tagline} />
        </Link>
        <div className="relative max-w-md">
          <h2 className="font-display text-3xl font-bold leading-tight">
            Quản lý nơi lưu trú, bài viết và bất động sản của bạn
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/85">
            Dành cho chủ cơ sở và cộng tác viên: cập nhật thông tin, hình ảnh, giá phòng cho địa điểm của bạn, đăng
            tin bất động sản hoặc viết cẩm nang du lịch Phước Hải. Tài khoản mới được quản trị viên duyệt trước khi
            sử dụng.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-white/90">
            <li>• Cập nhật giá, hình ảnh và liên hệ của địa điểm bất cứ lúc nào</li>
            <li>• Soạn bài bằng trình soạn thảo trực quan, chèn ảnh dễ dàng</li>
            <li>• Bài mới được biên tập viên duyệt trước khi hiển thị</li>
          </ul>
        </div>
        <p className="relative text-xs text-white/70">
          © {new Date().getFullYear()} {BRAND.name} - {BRAND.domain}
        </p>
      </div>
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
