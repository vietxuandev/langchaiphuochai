import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PostType } from '@phuochai/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/ui/section-heading';
import { HomeHero } from '@/components/site/home-hero';
import { PostCard } from '@/components/site/post-card';
import { getCategoriesBySection, getNavCategories } from '@/lib/data/categories';
import { getPublicStats, getPosts } from '@/lib/data/home';

/** Trang chủ: hero + thống kê + các khối nội dung nổi bật. */
export const revalidate = 300;

export default async function HomePage() {
  const [stats, categories] = await Promise.all([getPublicStats(), getNavCategories()]);
  const [accommodations, latestNews, realEstates] = await Promise.all([
    getPosts({ type: PostType.ACCOMMODATION, pageSize: 8, sortBy: 'VIEWS', sortOrder: 'DESC' }),
    getPosts({ type: PostType.NEWS, pageSize: 4, sortBy: 'PUBLISHED_AT', sortOrder: 'DESC' }),
    getPosts({ type: PostType.REAL_ESTATE, pageSize: 4, sortBy: 'PUBLISHED_AT', sortOrder: 'DESC' }),
  ]);

  const newsCategories = categories.filter((c) => c.section === PostType.NEWS && c.level >= 1).slice(0, 5);
  const accommodationCategories = await getCategoriesBySection(PostType.ACCOMMODATION);

  return (
    <div>
      <HomeHero stats={stats} />

      {/* --------------------------- Cẩm nang du lịch --------------------------- */}
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

        <div className="mt-6 flex flex-wrap gap-2">
          {newsCategories.map((category) => (
            <Link key={category.id} href={`/danh-muc/${category.slug}`}>
              <Badge variant="secondary" className="cursor-pointer px-3 py-1.5 hover:bg-sea-200">
                {category.name} · {category.postCount}
              </Badge>
            </Link>
          ))}
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {latestNews.items.slice(0, 4).map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </section>

      {/* --------------------------- Nơi lưu trú --------------------------- */}
      <section className="bg-muted/40 py-14">
        <div className="container">
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
        </div>
      </section>

      {/* ------------------------ Bất động sản ------------------------ */}
      {realEstates.items.length > 0 ? (
        <section className="container py-14">
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
      </section>
      ) : null}

    </div>
  );
}
