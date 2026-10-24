import Link from 'next/link';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { PostType } from '@phuochai/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SectionHeading } from '@/components/ui/section-heading';
import { HomeHero } from '@/components/site/home-hero';
import { PostCard } from '@/components/site/post-card';
import { getCategoriesBySection, getNavCategories } from '@/lib/data/categories';
import { getPublicStats, getPosts } from '@/lib/data/home';

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
      <HomeHero stats={stats} />

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
