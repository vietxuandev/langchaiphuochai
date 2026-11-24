import Image from 'next/image';
import Link from 'next/link';
import {
  BedDouble,
  BookOpen,
  Building2,
  Compass,
  Home,
  LayoutGrid,
  MapPinned,
  Search,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import heroImage from '@/assets/phuoc-hai-hero.jpg';

interface HomeHeroProps {
  stats: {
    accommodations: number;
    news: number;
    realEstates: number;
    categories: number;
    totalPosts: number;
  };
}

const QUICK_LINKS = [
  { label: 'Homestay', slug: 'homestay', icon: Home },
  { label: 'Khách sạn', slug: 'khach-san', icon: Building2 },
  { label: 'Villa', slug: 'villa', icon: Sparkles },
  { label: 'Quán ăn', slug: 'an-uong', icon: UtensilsCrossed },
  { label: 'Điểm tham quan', slug: 'diem-tham-quan', icon: Compass },
  { label: 'Bất động sản', slug: 'nha-ven-bien', icon: MapPinned },
];

const numberFormat = new Intl.NumberFormat('vi-VN');

/**
 * Hero trang chủ.
 *
 * Nội dung + thanh tìm kiếm giữ nguyên bản cũ của phuochai-web; chỉ thay
 * background gradient bằng ảnh biển full-bleed (lấy từ project dulichphuochai)
 * kèm lớp phủ tối để chữ trắng vẫn rõ.
 */
export function HomeHero({ stats }: HomeHeroProps) {
  return (
    <section className="relative overflow-hidden bg-[#123d45] text-white">
      <Image
        src={heroImage}
        alt="Bờ biển Phước Hải trong ánh nắng sớm"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      {/* Scrim rất nhẹ, chỉ phủ nửa trái để chữ dễ đọc mà vẫn giữ ảnh rõ */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-r from-[#082f35]/45 via-[#082f35]/18 to-transparent sm:w-3/4 lg:w-1/2" />

      <div className="container relative py-16 lg:py-24">
        <div className="max-w-4xl">
          <Badge className="hero-text-shadow bg-white/[0.15] text-white backdrop-blur">
            <Sparkles className="mr-1 h-3.5 w-3.5" /> Danh bạ lưu trú &amp; du lịch Phước Hải
          </Badge>
          <h1 className="hero-text-shadow mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Tìm nơi lưu trú, điểm đến và ẩm thực
            <span className="block text-coral-200">tuyệt vời nhất tại Phước Hải</span>
          </h1>
          <p className="hero-text-shadow mt-4 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">
            {stats.totalPosts}+ nơi lưu trú, quán ăn, điểm tham quan và kinh nghiệm du lịch Phước Hải - giúp bạn
            chọn chỗ ở và lên lịch trình cho chuyến đi chỉ trong vài phút.
          </p>

          <form action="/tim-kiem" className="mt-7 flex max-w-xl gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                placeholder="Nhập tên homestay, quán ăn, bãi tắm..."
                className="h-12 border-transparent bg-white pl-9 text-foreground shadow-lg"
                aria-label="Tìm kiếm"
              />
            </div>
            <Button type="submit" size="lg" className="h-12 bg-coral-500 hover:bg-coral-600">
              Tìm kiếm
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap gap-2">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.slug}
                href={`/danh-muc/${link.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.12] px-3.5 py-1.5 text-xs font-medium backdrop-blur transition hover:bg-white/25"
              >
                <link.icon className="h-3.5 w-3.5" /> {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Thống kê */}
        <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {[
            { label: 'Nơi lưu trú', value: stats.accommodations, icon: BedDouble },
            { label: 'Bài viết & cẩm nang', value: stats.news, icon: BookOpen },
            { label: 'Bất động sản', value: stats.realEstates, icon: Building2 },
            { label: 'Danh mục', value: stats.categories, icon: LayoutGrid },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.label}
                className="border-white/20 bg-white/10 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/15"
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/20">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-xl font-bold leading-none tabular-nums sm:text-2xl">
                      {numberFormat.format(item.value)}
                    </span>
                    <span className="mt-1 block truncate text-xs text-white/80">{item.label}</span>
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
