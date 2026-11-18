import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { BRAND } from '@phuochai/shared';
import { BrandLogo } from '@/components/site/brand-logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const metadata: Metadata = {
  title: 'Không tìm thấy trang',
  robots: { index: false, follow: true },
};

const QUICK_LINKS = [
  { href: '/luu-tru', label: 'Nơi lưu trú' },
  { href: '/tin-tuc', label: 'Tin tức & cẩm nang' },
  { href: '/bat-dong-san', label: 'Bất động sản' },
  { href: '/gioi-thieu', label: 'Giới thiệu' },
];

/**
 * Trang 404 chung: URL không có route, bài không tồn tại (notFound()) và slug lạ bị middleware
 * chặn trước khi vào route ISR. Không gọi API để luôn hiển thị được, kể cả khi API đang lỗi.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60">
        <div className="container flex h-16 items-center">
          <Link href="/" aria-label={`${BRAND.name} - Trang chủ`}>
            <BrandLogo className="h-10 w-10" withName subtitle={BRAND.tagline} />
          </Link>
        </div>
      </header>

      <main className="container flex flex-1 flex-col items-center justify-center py-16 text-center">
        <p className="font-display text-6xl font-bold text-primary/80">404</p>
        <h1 className="mt-4 font-display text-2xl font-bold sm:text-3xl">Không tìm thấy trang bạn cần</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Đường dẫn có thể đã thay đổi hoặc nội dung đã được gỡ. Bạn thử tìm kiếm hoặc xem các mục bên dưới nhé.
        </p>

        <form action="/tim-kiem" className="mt-6 flex w-full max-w-md gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              type="search"
              placeholder="Tìm homestay, quán ăn, điểm đến..."
              aria-label="Từ khoá tìm kiếm"
              className="h-11 pl-9"
            />
          </div>
          <Button type="submit" className="h-11">
            Tìm kiếm
          </Button>
        </form>

        <nav aria-label="Mục chính" className="mt-6 flex flex-wrap justify-center gap-2">
          {QUICK_LINKS.map((link) => (
            <Button key={link.href} variant="outline" size="sm" asChild>
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </nav>

        <Button variant="link" className="mt-4" asChild>
          <Link href="/">Về trang chủ</Link>
        </Button>
      </main>
    </div>
  );
}
