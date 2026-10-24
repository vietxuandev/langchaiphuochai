import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  Compass,
  Home,
  MapPinned,
  Newspaper,
  Sparkles,
  TrendingUp,
  UtensilsCrossed,
} from 'lucide-react';
import { PostType } from '@phuochai/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';
import { HomeHero } from '@/components/site/home-hero';
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
      <HomeHero />

      {/* ---------------------- Thống kê & lối vào nhanh ---------------------- */}
      <section id="kham-pha" className="scroll-mt-24 bg-[#f7f3eb] dark:bg-[#0a2226]">
        <div className="container py-10">
          <div className="rounded-[2rem] border border-[#123d45]/10 bg-[#fffdf8] p-5 shadow-[0_20px_50px_rgba(18,61,69,.08)] dark:border-white/10 dark:bg-[#102f34] dark:shadow-none sm:p-7">
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              {[
                { label: 'Nơi lưu trú', value: stats.accommodations, icon: Home },
                { label: 'Bài viết & cẩm nang', value: stats.news, icon: Newspaper },
                { label: 'Bất động sản', value: stats.realEstates, icon: Building2 },
                { label: 'Danh mục', value: stats.categories, icon: MapPinned },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-[#e6f4f1] text-[#0b6973] dark:bg-white/10 dark:text-[#8de0d4]">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-display text-2xl font-bold leading-none text-[#123d45] dark:text-white">{item.value}</p>
                    <p className="mt-1 text-xs text-[#6a7f82] dark:text-white/60">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-2 border-t border-[#123d45]/10 pt-5 dark:border-white/10">
              {QUICK_LINKS.map((link) => (
                <Link
                  key={link.slug}
                  href={`/danh-muc/${link.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#123d45]/10 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#36575c] transition hover:border-[#0b6973]/30 hover:text-[#0b6973] dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:border-[#8de0d4]/40 dark:hover:text-[#8de0d4]"
                >
                  <link.icon className="h-3.5 w-3.5" /> {link.label}
                </Link>
              ))}
            </div>
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
