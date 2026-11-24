'use client';

import Image from 'next/image';
import { useState } from 'react';
import {
  ArrowRight,
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
import { cn } from '@/lib/utils';
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

const QUICK_FILTERS = [
  { label: 'Homestay', keyword: 'Homestay tại Phước Hải', icon: Home },
  { label: 'Khách sạn', keyword: 'Khách sạn tại Phước Hải', icon: Building2 },
  { label: 'Villa', keyword: 'Villa tại Phước Hải', icon: Sparkles },
  { label: 'Quán ăn', keyword: 'Quán ăn tại Phước Hải', icon: UtensilsCrossed },
  { label: 'Điểm tham quan', keyword: 'Điểm tham quan tại Phước Hải', icon: Compass },
  { label: 'Bất động sản', keyword: 'Bất động sản tại Phước Hải', icon: MapPinned },
];

const numberFormat = new Intl.NumberFormat('vi-VN');

/**
 * Hero trang chủ theo hướng full-bleed ảnh biển.
 *
 * Header/logo/nav dùng chung ở SiteHeader (BrandLogo), hero chỉ tập trung vào
 * thông điệp, tìm kiếm, quick filter và số liệu. Toàn bộ control dùng shadcn.
 */
export function HomeHero({ stats }: HomeHeroProps) {
  const [keyword, setKeyword] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  const applyFilter = (filter: (typeof QUICK_FILTERS)[number]) => {
    setActiveFilter(filter.label);
    setKeyword(filter.keyword);
  };

  return (
    <section className="relative flex min-h-[680px] flex-col overflow-hidden bg-[#0b3036] text-white lg:min-h-[760px]">
      <Image
        src={heroImage}
        alt="Bờ biển Phước Hải trong ánh nắng sớm"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-black/15 to-black/65" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.22)_0%,transparent_70%)]" />

      <div className="container relative flex flex-1 flex-col justify-between gap-10 py-14 sm:py-16 lg:py-20">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center text-center">
          <Badge className="hero-text-shadow border border-white/25 bg-white/15 px-4 py-1.5 text-white backdrop-blur-md">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Danh bạ lưu trú &amp; du lịch Phước Hải
          </Badge>

          <h1 className="hero-text-shadow mt-5 max-w-4xl font-display text-3xl font-bold leading-[1.12] tracking-tight sm:text-4xl lg:text-5xl">
            Tìm nơi lưu trú, điểm đến và ẩm thực
            <span className="mt-1 block italic text-coral-300">tuyệt vời nhất tại Phước Hải</span>
          </h1>

          <p className="hero-text-shadow mt-5 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
            {numberFormat.format(stats.totalPosts)}+ nơi lưu trú, quán ăn, điểm tham quan và kinh nghiệm du lịch
            Phước Hải - giúp bạn chọn chỗ ở và lên lịch trình chỉ trong vài phút.
          </p>

          <Card className="mt-7 w-full max-w-3xl overflow-hidden border-white/60 bg-white/95 text-foreground shadow-2xl backdrop-blur-xl dark:border-white/20 dark:bg-background/95">
            <CardContent className="p-0">
              <div
                className="flex items-center gap-1 overflow-x-auto border-b border-border/60 px-3 pb-2 pt-2.5"
                role="group"
                aria-label="Lọc nhanh"
              >
                {QUICK_FILTERS.map((filter) => {
                  const Icon = filter.icon;
                  const active = activeFilter === filter.label;
                  return (
                    <Button
                      key={filter.label}
                      type="button"
                      variant={active ? 'default' : 'ghost'}
                      size="sm"
                      className={cn(
                        'shrink-0 gap-1.5 rounded-xl px-3.5',
                        active ? 'shadow-sm' : 'text-muted-foreground hover:bg-muted',
                      )}
                      aria-pressed={active}
                      onClick={() => applyFilter(filter)}
                    >
                      <Icon className="h-4 w-4" />
                      {filter.label}
                    </Button>
                  );
                })}
              </div>

              <form action="/tim-kiem" className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
                  <Input
                    name="q"
                    value={keyword}
                    onChange={(event) => {
                      setKeyword(event.target.value);
                      setActiveFilter('');
                    }}
                    placeholder="Nhập tên homestay, quán ăn, bãi tắm..."
                    aria-label="Tìm kiếm"
                    className="h-12 border-0 bg-transparent pl-10 text-base shadow-none focus-visible:ring-0"
                  />
                </div>
                <Button type="submit" size="lg" className="h-12 shrink-0 gap-2 bg-coral-500 hover:bg-coral-600">
                  Tìm kiếm
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
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
                <CardContent className="flex items-center gap-3 p-4 sm:p-4">
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
