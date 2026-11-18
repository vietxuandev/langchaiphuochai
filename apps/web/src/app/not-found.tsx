import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Compass,
  Home,
  MapPin,
  Newspaper,
  Phone,
  Search,
  Waves,
} from 'lucide-react';
import { BRAND } from '@phuochai/shared';
import { BrandLogo } from '@/components/site/brand-logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export const metadata: Metadata = {
  title: 'Không tìm thấy trang',
  robots: { index: false, follow: true },
};

const QUICK_LINKS = [
  {
    href: '/luu-tru',
    label: 'Nơi lưu trú',
    description: 'Homestay, khách sạn, resort tại Phước Hải',
    icon: Building2,
  },
  {
    href: '/tin-tuc',
    label: 'Tin tức & cẩm nang',
    description: 'Kinh nghiệm ăn uống, vui chơi, di chuyển',
    icon: Newspaper,
  },
  {
    href: '/bat-dong-san',
    label: 'Bất động sản',
    description: 'Nhà, đất và villa ven biển',
    icon: MapPin,
  },
  {
    href: '/gioi-thieu',
    label: 'Giới thiệu',
    description: 'Câu chuyện và định hướng của Làng Chài',
    icon: Compass,
  },
];

/**
 * Trang 404 chung cho URL không có route, bài không tồn tại và slug lạ bị middleware chặn.
 * Không gọi API để trang luôn hiển thị được, kể cả khi API gặp sự cố.
 */
export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-sea-50 via-background to-sand-50 dark:from-sea-900/30 dark:via-background dark:to-background">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-28 top-24 h-72 w-72 rounded-full bg-sea-200/60 blur-3xl dark:bg-sea-700/20" />
        <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-coral-200/50 blur-3xl dark:bg-coral-900/20" />
        <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-sea-100/80 to-transparent dark:from-sea-900/20" />
      </div>

      <header className="relative z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link href="/" aria-label={`${BRAND.name} - Trang chủ`}>
            <BrandLogo className="h-10 w-10" withName subtitle={BRAND.tagline} />
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" /> Trang chủ
            </Link>
          </Button>
        </div>
      </header>

      <main className="container relative z-10 flex flex-1 items-center py-12 sm:py-20">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[1.05fr_.95fr]">
          <section>
            <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-sea-800 dark:text-sea-100">
              <Waves className="h-3.5 w-3.5" /> Lạc đường giữa biển
            </Badge>

            <p
              aria-hidden="true"
              className="mt-5 bg-gradient-to-r from-sea-700 via-sea-500 to-coral-500 bg-clip-text font-display text-[6.5rem] font-bold leading-none tracking-tighter text-transparent sm:text-[8.5rem]"
            >
              404
            </p>

            <h1 className="mt-4 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Không tìm thấy trang bạn cần
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Có thể đường dẫn đã thay đổi, bài viết đã được gỡ hoặc bạn gõ nhầm địa chỉ. Thử tìm kiếm
              bên dưới hoặc chọn một trong các mục quen thuộc của Làng Chài Phước Hải.
            </p>

            <form action="/tim-kiem" className="mt-6 flex w-full max-w-xl flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  name="q"
                  type="search"
                  placeholder="Tìm homestay, quán ăn, điểm đến..."
                  aria-label="Từ khoá tìm kiếm"
                  className="h-11 bg-background/90 pl-9"
                />
              </div>
              <Button type="submit" className="h-11">
                Tìm kiếm
              </Button>
            </form>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/">
                  Về trang chủ <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/luu-tru">Xem nơi lưu trú</Link>
              </Button>
            </div>
          </section>

          <section className="space-y-4">
            <Card className="border-sea-200/70 bg-background/85 shadow-card backdrop-blur dark:border-sea-800/60">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-base">Bạn có thể muốn xem</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1.5">
                {QUICK_LINKS.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="group flex items-center gap-3 rounded-xl border border-transparent p-3 transition hover:border-sea-200 hover:bg-sea-50/80 dark:hover:border-sea-800 dark:hover:bg-sea-900/30"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sea-100 text-sea-700 dark:bg-sea-900/60 dark:text-sea-200">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{link.label}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{link.description}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-sea-700" />
                    </Link>
                  );
                })}
              </CardContent>
            </Card>

            <div className="rounded-2xl bg-sea-700 p-5 text-white shadow-soft">
              <p className="text-sm font-semibold">Cần hỗ trợ tìm đúng trang?</p>
              <a
                href={`tel:${BRAND.phone}`}
                className="mt-2 inline-flex items-center gap-2 font-display text-xl font-bold hover:underline"
              >
                <Phone className="h-5 w-5" /> {BRAND.phoneDisplay}
              </a>
              <p className="mt-2 text-xs text-sea-100">
                {BRAND.address} · {BRAND.email}
              </p>
            </div>
          </section>
        </div>
      </main>

      <footer className="relative z-10 border-t border-border/60 bg-background/70">
        <div className="container flex flex-col gap-1 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {BRAND.name}. {BRAND.tagline}.
          </p>
          <p>{BRAND.domain}</p>
        </div>
      </footer>
    </div>
  );
}
