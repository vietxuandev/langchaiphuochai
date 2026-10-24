import Image from 'next/image';
import Link from 'next/link';
import {
  Building2,
  Compass,
  Home,
  MapPinned,
  Newspaper,
  Search,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(5,34,39,.82) 0%, rgba(5,34,39,.46) 48%, rgba(5,34,39,.18) 100%)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#082f35]/80 via-transparent to-black/20" />

      <div className="container relative py-16 lg:py-24">
        <div className="max-w-4xl">
          <Badge className="bg-white/[0.15] text-white backdrop-blur">
            <Sparkles className="mr-1 h-3.5 w-3.5" /> Danh bạ lưu trú &amp; du lịch Phước Hải
          </Badge>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Tìm nơi lưu trú, điểm đến và ẩm thực
            <span className="block text-coral-200">tuyệt vời nhất tại Phước Hải</span>
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">
            {stats.totalPosts}+ địa điểm và bài viết được tổng hợp, chuẩn hoá từ dữ liệu gốc - giúp bạn chọn chỗ ở,
            lên lịch trình và tìm hiểu về vùng biển Phước Hải chỉ trong vài phút.
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
        <div className="mt-10 grid grid-cols-2 gap-3 rounded-2xl border border-white/[0.15] bg-white/10 p-4 backdrop-blur sm:grid-cols-4 sm:gap-6 sm:p-6">
          {[
            { label: 'Nơi lưu trú', value: stats.accommodations, icon: Home },
            { label: 'Bài viết & cẩm nang', value: stats.news, icon: Newspaper },
            { label: 'Bất động sản', value: stats.realEstates, icon: Building2 },
            { label: 'Danh mục', value: stats.categories, icon: MapPinned },
          ].map((item) => (
            <div key={item.label} className="text-center sm:text-left">
              <div className="flex items-center justify-center gap-2 sm:justify-start">
                <item.icon className="h-4 w-4 text-coral-200" />
                <span className="font-display text-2xl font-bold">{item.value}</span>
              </div>
              <p className="mt-0.5 text-xs text-white/80">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
