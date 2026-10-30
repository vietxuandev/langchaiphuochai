import { BRAND } from '@phuochai/shared';
import { cn } from '@/lib/utils';

/** Đường dẫn logo trong thư mục public. */
const LOGO_MARK_SRC = '/icons/logo-mark.png';

interface BrandLogoProps {
  /** Kích thước & bo góc, ví dụ "h-10 w-10". */
  className?: string;
  /** Hiển thị tên thương hiệu cạnh logo. */
  withName?: boolean;
  /** Dòng mô tả nhỏ dưới tên (chỉ hiện khi có `withName`). */
  subtitle?: string;
  /** Tên dùng màu sáng (đặt trên nền tối). */
  inverted?: boolean;
  nameClassName?: string;
}

/**
 * Logo thương hiệu dùng chung cho header, footer, sidebar quản trị và trang đăng nhập.
 *
 * Ảnh `/icons/logo-mark.png` (128px, ~30KB) được tối ưu từ bộ favicon 512px của dự án nên
 * mọi nơi đều hiển thị cùng một logo, không còn SVG tự vẽ riêng lẻ.
 * Dùng đường dẫn public (không import file ảnh) để không phụ thuộc bundler khi chạy test.
 */
export function BrandLogo({
  className,
  withName = false,
  subtitle,
  inverted = false,
  nameClassName,
}: BrandLogoProps) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_MARK_SRC}
        alt={`Logo ${BRAND.name}`}
        width={128}
        height={128}
        className={cn('shrink-0 rounded-full object-contain', className)}
        loading="eager"
        decoding="async"
      />
      {withName ? (
        <span className="min-w-0 leading-tight">
          <span
            className={cn(
              'block truncate font-display text-base font-bold leading-tight tracking-tight sm:text-lg',
              inverted ? 'text-white' : 'text-sea-700',
              nameClassName,
            )}
          >
            {BRAND.name}
          </span>
          {subtitle ? (
            <span
              className={cn(
                'hidden text-[10px] font-medium uppercase tracking-[0.16em] sm:block',
                inverted ? 'text-white/70' : 'text-muted-foreground',
              )}
            >
              {subtitle}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
