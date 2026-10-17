import Link from 'next/link';
import { BRAND } from '@phuochai/shared';

/** Layout cho trang đăng nhập / đăng ký: tối giản, tập trung vào form. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-hero-gradient p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-16 top-1/3 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <Link href="/" className="relative font-display text-xl font-bold">
          {BRAND.name}
        </Link>
        <div className="relative max-w-md">
          <h2 className="font-display text-3xl font-bold leading-tight">
            Quản lý nơi lưu trú, bài viết và bất động sản của bạn
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-white/85">
            Hệ thống phân quyền 3 cấp: quản trị viên, người đăng bài và thành viên. Đăng nhập để cập nhật thông tin
            địa điểm, đăng tin và theo dõi hiệu quả nội dung.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-white/90">
            <li>• Bảng điều khiển thống kê trực quan</li>
            <li>• Quản lý bài viết với bảng dữ liệu và bộ lọc</li>
            <li>• Phân quyền chi tiết theo vai trò</li>
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
