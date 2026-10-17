import Link from 'next/link';
import {
  Bath,
  BedDouble,
  Building2,
  Calendar,
  CheckCircle2,
  Compass,
  Eye,
  FileText,
  Landmark,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Ruler,
  Route,
  Tag as TagIcon,
} from 'lucide-react';
import { BRAND, POST_TYPE_LABELS, PostType, buildImageUrl, formatAddress, formatDate, formatVnd } from '@phuochai/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Gallery } from '@/components/site/gallery';
import { ShareButtons } from '@/components/site/share-buttons';
import { PostCard, postHref } from '@/components/site/post-card';
import type { PostFullFragment, PostCardFragment } from '@/generated/graphql';

interface PostDetailProps {
  post: PostFullFragment;
  related: PostCardFragment[];
}

/** Khối thuộc tính dạng lưới (diện tích, phòng ngủ, hướng...). */
function AttributeGrid({ post }: { post: PostFullFragment }) {
  const items = [
    post.areaText || post.areaM2 ? { icon: Ruler, label: 'Diện tích', value: post.areaText ?? `${post.areaM2} m²` } : null,
    post.dimensions ? { icon: Route, label: 'Kích thước', value: post.dimensions } : null,
    post.bedrooms ? { icon: BedDouble, label: 'Phòng ngủ', value: `${post.bedrooms}` } : null,
    post.bathrooms ? { icon: Bath, label: 'Phòng tắm / WC', value: `${post.bathrooms}` } : null,
    post.floors ? { icon: Building2, label: 'Số tầng', value: `${post.floors}` } : null,
    post.direction ? { icon: Compass, label: 'Hướng', value: post.direction } : null,
    post.roadWidth ? { icon: Route, label: 'Đường trước nhà', value: post.roadWidth } : null,
    post.legal ? { icon: Landmark, label: 'Pháp lý', value: post.legal } : null,
  ].filter((item): item is { icon: typeof Ruler; label: string; value: string } => !!item);

  const attributes =
    post.attributes && typeof post.attributes === 'object' && !Array.isArray(post.attributes)
      ? Object.entries(post.attributes as Record<string, unknown>).filter(
          ([key]) => !items.some((item) => item.label === key),
        )
      : [];

  if (items.length === 0 && attributes.length === 0) return null;

  return (
    <Card className="border-border/70 shadow-soft">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base">Thông tin chi tiết</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className="rounded-xl bg-muted/60 p-3">
              <item.icon className="h-4 w-4 text-sea-600" />
              <p className="mt-2 text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-semibold">{item.value}</p>
            </div>
          ))}
        </div>

        {attributes.length > 0 ? (
          <>
            <Separator className="my-4" />
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {attributes.map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-4 border-b border-dashed border-border/70 py-1.5">
                  <dt className="text-muted-foreground">{key}</dt>
                  <dd className="font-medium">{String(value)}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Trang chi tiết dùng chung cho cả 4 loại nội dung. */
export function PostDetail({ post, related }: PostDetailProps) {
  const typeLabel = POST_TYPE_LABELS[post.type as PostType] ?? 'Bài viết';
  const isProduct = post.type === PostType.ACCOMMODATION || post.type === PostType.REAL_ESTATE;

  const contactPhone = post.contactPhone ?? null;
  const contactZalo = post.contactZalo ?? null;
  const contactEmail = post.contactEmail ?? null;

  return (
    <article className="container py-6">
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-primary">
          Trang chủ
        </Link>
        <span>/</span>
        <Link
          href={
            post.type === PostType.ACCOMMODATION
              ? '/luu-tru'
              : post.type === PostType.NEWS
                ? '/tin-tuc'
                : post.type === PostType.REAL_ESTATE
                  ? '/bat-dong-san'
                  : '/gioi-thieu'
          }
          className="hover:text-primary"
        >
          {typeLabel}
        </Link>
        {post.category ? (
          <>
            <span>/</span>
            <Link href={`/danh-muc/${post.category.slug}`} className="hover:text-primary">
              {post.category.name}
            </Link>
          </>
        ) : null}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Gallery images={post.images} title={post.title} />

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{post.category?.name ?? typeLabel}</Badge>
              {post.verified ? (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Đã xác thực
                </Badge>
              ) : null}
              {post.code ? <Badge variant="muted">Mã tin: {post.code}</Badge> : null}
            </div>

            <h1 className="mt-3 font-display text-2xl font-bold leading-tight md:text-3xl">{post.title}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {formatAddress({ addressRaw: post.addressRaw, ward: post.ward, city: post.city }) || 'Phước Hải'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> {formatDate(post.publishedAt ?? post.createdAt)}
              </span>
              {post.views > 0 ? (
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="h-4 w-4" /> {post.views} lượt xem
                </span>
              ) : null}
            </div>

            {post.summary ? (
              <p className="mt-4 rounded-xl border-l-4 border-primary bg-muted/50 p-4 text-sm leading-relaxed">
                {post.summary}
              </p>
            ) : null}
          </div>

          {post.contentHtml ? (
            <div
              className="prose-phuochai max-w-none"
              // Nội dung được kế thừa từ site cũ; ảnh đã trỏ về /media local.
              dangerouslySetInnerHTML={{ __html: post.contentHtml }}
            />
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
                <FileText className="h-5 w-5" />
                Bài viết này chưa có nội dung chi tiết trên hệ thống cũ. Bạn có thể bổ sung mô tả trong trang quản trị.
              </CardContent>
            </Card>
          )}

          {isProduct ? <AttributeGrid post={post} /> : null}

          {post.tags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <TagIcon className="h-4 w-4 text-muted-foreground" />
              {post.tags.map((tag) => (
                <Link key={tag.id} href={`/tim-kiem?q=${encodeURIComponent(tag.name)}`}>
                  <Badge variant="outline" className="cursor-pointer hover:border-primary hover:text-primary">
                    {tag.name}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        {/* Sidebar: giá, liên hệ, hành động */}
        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <Card className="border-border/70 shadow-card">
            <CardContent className="p-5">
              {post.priceValue != null ? (
                <>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {post.type === PostType.REAL_ESTATE ? 'Mức giá' : 'Giá từ'}
                  </p>
                  <p className="font-display text-2xl font-bold text-coral-500">{formatVnd(post.priceValue)}</p>
                  {post.pricePerM2Value ? (
                    <p className="text-xs text-muted-foreground">
                      ~ {formatVnd(post.pricePerM2Value)}/m²
                      {post.pricePerM2Raw ? ` · ${post.pricePerM2Raw}` : ''}
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Giá</p>
                  <p className="font-display text-xl font-semibold">{post.priceRaw ?? 'Liên hệ để biết giá'}</p>
                </>
              )}

              <Separator className="my-4" />

              <div className="space-y-2">
                {contactPhone ? (
                  <Button className="w-full" asChild>
                    <a href={`tel:${contactPhone}`}>
                      <Phone className="mr-2 h-4 w-4" /> {contactPhone}
                    </a>
                  </Button>
                ) : (
                  <Button className="w-full" asChild>
                    <a href={`tel:${BRAND.phone}`}>
                      <Phone className="mr-2 h-4 w-4" /> Gọi tư vấn: {BRAND.phoneDisplay}
                    </a>
                  </Button>
                )}

                {contactZalo ? (
                  <Button variant="outline" className="w-full" asChild>
                    <a href={`https://zalo.me/${contactZalo}`} target="_blank" rel="noreferrer">
                      <MessageCircle className="mr-2 h-4 w-4" /> Chat Zalo
                    </a>
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" asChild>
                    <a href={`https://zalo.me/${BRAND.zalo}`} target="_blank" rel="noreferrer">
                      <MessageCircle className="mr-2 h-4 w-4" /> Chat Zalo
                    </a>
                  </Button>
                )}

                {contactEmail ? (
                  <Button variant="ghost" className="w-full" asChild>
                    <a href={`mailto:${contactEmail}`}>
                      <Mail className="mr-2 h-4 w-4" /> {contactEmail}
                    </a>
                  </Button>
                ) : null}
              </div>

              <Separator className="my-4" />

              <div className="space-y-2 text-xs text-muted-foreground">
                <ShareButtons path={postHref(post)} />
              </div>
            </CardContent>
          </Card>

          {post.author ? (
            <Card className="border-border/70">
              <CardContent className="flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sea-100 font-semibold text-sea-700">
                  {post.author.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{post.author.name}</p>
                  <p className="text-xs text-muted-foreground">Người đăng bài</p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>

      {related.length > 0 ? (
        <section className="mt-14">
          <div className="mb-5 flex items-end justify-between">
            <h2 className="font-display text-xl font-bold">Có thể bạn cũng thích</h2>
            <Link href="/tim-kiem" className="text-sm text-primary hover:underline">
              Xem thêm
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <PostCard key={item.id} post={item} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
