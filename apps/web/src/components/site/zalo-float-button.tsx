import Image from 'next/image';
import { BRAND } from '@phuochai/shared';
import zaloIcon from '@/assets/zalo.svg';

/**
 * Nút liên hệ Zalo cố định ở góc phải dưới.
 *
 * Chỉ đặt trong layout của khu vực công khai `(site)` - không hiện ở
 * trang quản trị hoặc trang đăng nhập.
 */
export function ZaloFloatButton() {
  return (
    <a
      href={`https://zalo.me/${BRAND.zalo}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Nhắn tin qua Zalo: ${BRAND.phoneDisplay}`}
      title={`Nhắn tin qua Zalo: ${BRAND.phoneDisplay}`}
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-[#0068FF] py-2.5 pl-2.5 pr-4 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(0,104,255,0.35)] transition hover:-translate-y-0.5 hover:bg-[#0057D9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0068FF] sm:bottom-6 sm:right-6"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white shadow-sm">
        <Image src={zaloIcon} alt="" width={24} height={24} className="h-6 w-6" unoptimized />
      </span>
      <span className="hidden sm:inline">Nhắn Zalo</span>
      <span className="sm:hidden">Zalo</span>
    </a>
  );
}
