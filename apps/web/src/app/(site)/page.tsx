import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Compass,
  Home,
  MapPinned,
  Newspaper,
  Search,
  Sparkles,
  TrendingUp,
  UtensilsCrossed,
} from 'lucide-react';
import { PostType } from '@phuochai/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SectionHeading } from '@/components/ui/section-heading';
import { PostCard } from '@/components/site/post-card';
import { getCategoriesBySection, getNavCategories } from '@/lib/data/categories';
import { getPublicStats, getPosts } from '@/lib/data/home';

const QUICK_LINKS = [
  { label: 'Homestay', slug: 'homestay', icon: Home },
  { label: 'Khách sạn', slug: 'khach-san', icon: Building2 },
  { label: 'Villa', slug: 'villa', icon: Sparkles },
  { label: 'Quán ăn', slug: 'an-uong', icon: UtensilsCrossed },
  { label: 'Điểm tham quan', slug: 'diem-tham-quan', icon: Compass },
  { label: 'Bất động sản', slug: 'nha-ven-bien', icon: MapPinned },
];

/** Trang chủ: hero + thống kê + các khối nội dung nổi bật. */
export default async function HomePage() {
  const [stats, categories] = await Promise.all([getPublicStats(), getNavCategories()]);
  const [accommodations, latestNews, realEstates] = await Promise.all([
    getPosts({ type: PostType.ACCOMMODATION, pageSize: 8, sortBy: 'VIEWS', sortOrder: 'DESC' }),
    getPosts({ type: PostType.NEWS, pageSize: 6, sortBy: 'PUBLISHED_AT', sortOrder: 'DESC' }),
    getPosts({ type: PostType.REAL_ESTATE, pageSize: 4, sortBy: 'PUBLISHED_AT', sortOrder: 'DESC' }),
  ]);

  const newsCategories = categories.filter((c) => c.section === PostType.NEWS && c.level >= 1).slice(0, 5);
  const accommodationCategories = await getCategoriesBySection(PostType.ACCOMMODATION);

  return (
    <div>
      {/* ------------------------------- HERO ------------------------------- */}
      <section className="relative overflow-hidden bg-hero-gradient text-white">
        {/*
          Ảnh nền: bãi biển + khu nghỉ dưỡng Phước Hải (public/hero-phuoc-hai.jpg, 1600px, ~140KB).
          Dùng <img> + object-cover thay vì next/image để không phụ thuộc sharp khi chạy standalone.
          `bg-hero-gradient` ở <section> giữ lại làm màu nền dự phòng nếu ảnh không tải được.
        */}
        <div className="absolute inset-0">
          <img
            src="/hero-phuoc-hai.jpg"
            alt="Bãi biển và khu nghỉ dưỡng ven biển Phước Hải"
            className="h-full w-full object-cover object-[62%_60%]"
            fetchPriority="high"
            decoding="async"
          />
          {/*
            Lớp phủ: đậm ở nửa trái (nơi có chữ trắng) và gần như trong suốt ở bên phải
            để khu nghỉ dưỡng + bãi biển vẫn hiện rõ.
          */}
          <div className="absolute inset-0 bg-gradient-to-r from-sea-900/95 via-sea-900/75 via-45% to-sea-900/0 to-75%" />
          <div className="absolute inset-0 bg-gradient-to-t from-sea-900/80 via-sea-900/10 via-30% to-transparent" />
          {/* Trên điện thoại chữ trải hết chiều ngang nên cần phủ đều hơn để đủ tương phản */}
          <div className="absolute inset-0 bg-sea-900/40 sm:hidden" />
        </div>

        <div className="container relative py-16 lg:py-24">
          <div className="max-w-3xl">
            <Badge className="bg-white/15 text-white backdrop-blur">
              <Sparkles className="mr-1 h-3.5 w-3.5" /> Danh bạ lưu trú &amp; du lịch Phước Hải
            </Badge>
            <h1 className="mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              Tìm nơi lưu trú, điểm đến và ẩm thực
              <span className="block text-coral-200">tuyệt vời nhất tại Phước Hải</span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
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
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3.5 py-1.5 text-xs font-medium backdrop-blur transition hover:bg-white/25"
                >
                  <link.icon className="h-3.5 w-3.5" /> {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Thống kê */}
        <div className="container relative pb-12">
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur sm:grid-cols-4 sm:gap-6 sm:p-6">
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

      {/* --------------------------- Nơi lưu trú --------------------------- */}
      <section className="container py-14">
        <SectionHeading
          eyebrow="Nơi lưu trú"
          title="Được xem nhiều nhất tại Phước Hải"
          description="Khách sạn, homestay, villa và resort với thông tin giá, vị trí và hình ảnh thực tế."
          action={
            <Button variant="outline" asChild>
              <Link href="/luu-tru">
                Xem tất cả <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          }
        />

        <div className="mt-6 flex flex-wrap gap-2">
          {accommodationCategories.map((category) => (
            <Link key={category.id} href={`/danh-muc/${category.slug}`}>
              <Badge variant="secondary" className="cursor-pointer px-3 py-1.5 hover:bg-sea-200">
                {category.name} · {category.postCount}
              </Badge>
            </Link>
          ))}
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {accommodations.items.map((post, index) => (
            <PostCard key={post.id} post={post} priority={index < 4} />
          ))}
        </div>
      </section>

      {/* ------------------------ Bất động sản ------------------------ */}
      {realEstates.items.length > 0 ? (
        <section className="bg-muted/40 py-14">
          <div className="container">
            <SectionHeading
              eyebrow="Bất động sản"
              title="Nhà đất & villa ven biển"
              description="Danh sách bất động sản với mức giá, diện tích và pháp lý rõ ràng."
              action={
                <Button variant="outline" asChild>
                  <Link href="/bat-dong-san">
                    Xem tất cả <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              }
            />
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {realEstates.items.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ----------------------------- Tin tức ----------------------------- */}
      <section className="container py-14">
        <SectionHeading
          eyebrow="Cẩm nang du lịch"
          title="Tin tức & kinh nghiệm mới nhất"
          description="Ăn gì, đi đâu, ở đâu và những kinh nghiệm thực tế khi du lịch Phước Hải."
          action={
            <Button variant="outline" asChild>
              <Link href="/tin-tuc">
                Xem tất cả <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          }
        />

        <div className="mt-6 grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div className="grid gap-5 sm:grid-cols-2">
            {latestNews.items.slice(0, 4).map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          <div className="space-y-4">
            <Card className="border-border/70 shadow-soft">
              <CardContent className="p-5">
                <p className="flex items-center gap-2 font-display text-sm font-semibold">
                  <TrendingUp className="h-4 w-4 text-coral-500" /> Chủ đề được quan tâm
                </p>
                <div className="mt-3 space-y-2">
                  {newsCategories.map((category) => (
                    <Link
                      key={category.id}
                      href={`/danh-muc/${category.slug}`}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition hover:bg-muted"
                    >
                      <span>{category.name}</span>
                      <span className="text-xs text-muted-foreground">{category.postCount} bài</span>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-sea-50 shadow-soft dark:bg-sea-900/30">
              <CardContent className="p-5">
                <p className="font-display text-sm font-semibold">Bạn là chủ địa điểm?</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Đăng nhập để cập nhật thông tin, hình ảnh và giá cho địa điểm của bạn trên hệ thống.
                </p>
                <Button className="mt-4 w-full" asChild>
                  <Link href="/dang-nhap">Đăng nhập để quản lý</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {latestNews.items.length > 4 ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {latestNews.items.slice(4).map((post) => (
              <PostCard key={post.id} post={post} variant="horizontal" />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
