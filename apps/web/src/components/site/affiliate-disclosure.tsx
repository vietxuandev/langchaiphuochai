import Link from 'next/link';
import { Info } from 'lucide-react';

/** Hiển thị ở đầu bài có link affiliate, giúp minh bạch với người đọc. */
export function AffiliateDisclosure() {
  return (
    <aside
      aria-label="Thông báo về liên kết tiếp thị"
      className="my-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm leading-relaxed text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        Bài viết có thể chứa liên kết tiếp thị liên kết. Nếu bạn mua qua liên kết, Làng Chài Phước Hải có thể nhận
        một khoản hoa hồng nhỏ, không làm thay đổi giá bạn phải trả.{' '}
        <Link href="/trang/chinh-sach-bao-mat" className="font-medium underline underline-offset-2">
          Tìm hiểu thêm
        </Link>
        .
      </p>
    </aside>
  );
}
