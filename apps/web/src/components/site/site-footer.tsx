import Link from 'next/link';
import { Facebook, Mail, MapPin, Phone } from 'lucide-react';
import { BrandLogo } from '@/components/site/brand-logo';
import { BRAND, PostType } from '@phuochai/shared';
import type { CategoryNodeFragment } from '@/generated/graphql';

interface SiteFooterProps {
  categories: CategoryNodeFragment[];
}

/** Footer công khai: giới thiệu, liên kết nhanh theo danh mục, liên hệ. */
export function SiteFooter({ categories }: SiteFooterProps) {
  const accommodations = categories.filter((c) => c.section === PostType.ACCOMMODATION && c.level >= 1).slice(0, 6);
  const news = categories.filter((c) => c.section === PostType.NEWS && c.level >= 1).slice(0, 6);
  const realEstates = categories.filter((c) => c.section === PostType.REAL_ESTATE && c.level >= 1).slice(0, 6);

  return (
    <footer className="mt-16 border-t border-border bg-sea-900 text-sea-50">
      <div className="container grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">

            <BrandLogo className="h-10 w-10" />

            <p className="font-display text-lg font-bold text-white">{BRAND.name}</p>

          </div>
          <p className="mt-3 text-sm leading-relaxed text-sea-100/80">
            Danh bạ lưu trú và cẩm nang du lịch Phước Hải: khách sạn, homestay, villa, điểm đến, ăn uống và kinh
            nghiệm cần thiết cho chuyến đi của bạn.
          </p>
          <div className="mt-4 space-y-2 text-sm text-sea-100/90">
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> {BRAND.address}
            </p>
            <a href={`tel:${BRAND.phone}`} className="flex items-center gap-2 hover:text-white">
              <Phone className="h-4 w-4" /> {BRAND.phoneDisplay}
            </a>
            <a href={`mailto:${BRAND.email}`} className="flex items-center gap-2 hover:text-white">
              <Mail className="h-4 w-4" /> {BRAND.email}
            </a>
            <a href={BRAND.facebook} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-white">
              <Facebook className="h-4 w-4" /> Facebook
            </a>
          </div>
        </div>

        <FooterColumn title="Nơi lưu trú" href="/luu-tru" items={accommodations} />
        <FooterColumn title="Tin tức &amp; cẩm nang" href="/tin-tuc" items={news} />
        <FooterColumn title="Bất động sản" href="/bat-dong-san" items={realEstates} />
      </div>

      <div className="border-t border-white/10">
        <div className="container flex flex-col items-center justify-between gap-3 py-5 text-xs text-sea-100/70 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {BRAND.name} - {BRAND.domain}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/gioi-thieu" className="hover:text-white">
              Giới thiệu
            </Link>
            <Link href="/trang/cau-hoi-thuong-gap-faq" className="hover:text-white">
              Câu hỏi thường gặp
            </Link>
            <Link href="/trang/bang-gia-goi-dich-vu" className="hover:text-white">
              Bảng giá dịch vụ
            </Link>
            <Link href="/dang-nhap" className="hover:text-white">
              Đăng nhập
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  href,
  items,
}: {
  title: string;
  href: string;
  items: CategoryNodeFragment[];
}) {
  return (
    <div>
      <Link href={href} className="font-display text-sm font-semibold uppercase tracking-wide text-white">
        {title}
      </Link>
      <ul className="mt-4 space-y-2 text-sm text-sea-100/80">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={`/danh-muc/${item.slug}`} className="transition hover:text-white">
              {item.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
