import Link from 'next/link';
import { BedDouble, MapPin, Ruler, ArrowUpRight } from 'lucide-react';
import {
  PostType,
  buildImageUrl,
  formatDate,
  formatPriceShort,
  priceSuffix,
  stripAdministrativeParts,
  truncate,
} from '@phuochai/shared';
import { Badge } from '@/components/ui/badge';
import { PostCardImage } from '@/components/site/post-card-image';
import { Card } from '@/components/ui/card';
import { imageAlt } from '@/lib/image-alt';
import { cn } from '@/lib/utils';
import type { PostCardFragment } from '@/generated/graphql';

/**
 * Dòng vị trí trên thẻ: chỉ địa chỉ chi tiết (đường, khu phố). Cả site đều ở Xã Phước Hải,
 * TP. Hồ Chí Minh nên lặp lại xã/thành phố trên mọi thẻ chỉ gây rối; tin tức thì không hiện vị trí.
 */
function cardLocation(post: PostCardFragment): string | null {
  if (post.type !== PostType.ACCOMMODATION && post.type !== PostType.REAL_ESTATE) return null;
  return stripAdministrativeParts(post.addressRaw, { ward: post.ward }) || null;
}

/** Ngày đăng có ý nghĩa với tin tức và tin bất động sản; với nơi lưu trú (ngày nhập dữ liệu) thì bỏ. */
function showCardDate(post: PostCardFragment): boolean {
  return post.type !== PostType.ACCOMMODATION;
}

/** Giá gọn kèm đơn vị: "1,2 triệu/đêm", "9,5 tỷ". */
function cardPrice(post: PostCardFragment): string | null {
  return post.priceValue != null ? `${formatPriceShort(post.priceValue)}${priceSuffix(post.type)}` : null;
}

interface PostCardProps {
  post: PostCardFragment;
  /** Biến thể hiển thị: dọc (mặc định) hoặc ngang gọn cho danh sách. */
  variant?: 'default' | 'compact' | 'horizontal';
  className?: string;
  priority?: boolean;
}

/** Đường dẫn chi tiết theo loại nội dung. */
export function postHref(post: Pick<PostCardFragment, 'type' | 'slug'>): string {
  switch (post.type) {
    case PostType.ACCOMMODATION:
      return `/luu-tru/${post.slug}`;
    case PostType.NEWS:
      return `/tin-tuc/${post.slug}`;
    case PostType.REAL_ESTATE:
      return `/bat-dong-san/${post.slug}`;
    default:
      return `/trang/${post.slug}`;
  }
}

/** Thẻ bài viết dùng chung cho mọi danh sách: lưu trú, tin tức, bất động sản. */
export function PostCard({ post, variant = 'default', className, priority = false }: PostCardProps) {
  const image = post.heroImage ? buildImageUrl(post.heroImage) : null;
  const alt = imageAlt(post.heroImage?.alt, post.title);
  const href = postHref(post);
  const isRealEstate = post.type === PostType.REAL_ESTATE;
  const isProduct = isRealEstate || post.type === PostType.ACCOMMODATION;
  const location = cardLocation(post);
  const price = cardPrice(post);
  const showDate = showCardDate(post);

  if (variant === 'compact') {
    return (
      <Link href={href} className={cn('group flex gap-3 rounded-xl p-2 transition hover:bg-muted/60', className)}>
        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-muted">
          <PostCardImage src={image} alt={alt} priority={priority} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">{post.title}</p>
          {location ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="line-clamp-1">{location}</span>
            </p>
          ) : null}
        </div>
      </Link>
    );
  }

  if (variant === 'horizontal') {
    return (
      <Card className={cn('group overflow-hidden border-border/70 shadow-soft transition hover:shadow-card', className)}>
        <Link href={href} className="flex flex-col sm:flex-row">
          <div className="relative h-48 w-full overflow-hidden bg-muted sm:h-auto sm:w-56">
            <PostCardImage src={image} alt={alt} priority={priority} />
            <Badge variant="secondary" className="absolute left-2 top-2 bg-white/90 text-foreground">
              {post.category?.name ?? 'Phước Hải'}
            </Badge>
          </div>
          <div className="flex flex-1 flex-col justify-between p-4">
            <div>
              <h3 className="line-clamp-2 font-display text-base font-semibold leading-snug group-hover:text-primary">
                {post.title}
              </h3>
              <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{truncate(post.summary, 140)}</p>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              {/* Tin tức không có giá: hiện lời mời đọc thay vì "Đang cập nhật" */}
              {isProduct ? (
                <span className="font-semibold text-coral-500">{price ?? post.priceRaw ?? 'Liên hệ'}</span>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-primary">
                  Đọc bài <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              )}
              {showDate ? (
                <span className="text-xs text-muted-foreground">{formatDate(post.publishedAt ?? post.createdAt)}</span>
              ) : null}
            </div>
          </div>
        </Link>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'group flex h-full flex-col overflow-hidden border-border/70 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-card',
        className,
      )}
    >
      <Link href={href} className="relative block aspect-[4/3] overflow-hidden bg-muted">
        <PostCardImage src={image} alt={alt} priority={priority} className="duration-700 group-hover:scale-110" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <Badge variant="secondary" className="bg-white/90 text-foreground shadow-sm backdrop-blur">
            {post.category?.name ?? 'Phước Hải'}
          </Badge>
          {price ? (
            <Badge variant="default" className="bg-coral-500 text-white shadow-sm">
              {price}
            </Badge>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link href={href}>
          <h3 className="line-clamp-2 font-display text-base font-semibold leading-snug transition group-hover:text-primary">
            {post.title}
          </h3>
        </Link>

        {location ? (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">{location}</span>
          </p>
        ) : null}

        <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">{truncate(post.summary, 130)}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-border pt-3 text-xs text-muted-foreground">
          {isRealEstate ? (
            <>
              {post.areaM2 ? (
                <span className="inline-flex items-center gap-1">
                  <Ruler className="h-3.5 w-3.5" /> {post.areaM2} m²
                </span>
              ) : null}
              {post.bedrooms ? (
                <span className="inline-flex items-center gap-1">
                  <BedDouble className="h-3.5 w-3.5" /> {post.bedrooms} PN
                </span>
              ) : null}
            </>
          ) : (
            <span className="inline-flex items-center gap-1 font-medium text-primary">
              Xem chi tiết <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          )}
          {showDate ? <span className="ml-auto">{formatDate(post.publishedAt ?? post.createdAt)}</span> : null}
        </div>
      </div>
    </Card>
  );
}
