import Image from 'next/image';
import { BRAND } from '@phuochai/shared';
import zaloIcon from '@/assets/zalo.svg';

/**
 * Icon Zalo official, cố định ở góc phải dưới.
 *
 * Không bọc nền/nhãn/button quanh icon - bản thân SVG đã là icon hoàn chỉnh.
 * Chỉ đặt trong layout của khu vực công khai `(site)`.
 */
export function ZaloFloatButton() {
  return (
    <a
      href={`https://zalo.me/${BRAND.zalo}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Nhắn tin qua Zalo: ${BRAND.phoneDisplay}`}
      title={`Nhắn tin qua Zalo: ${BRAND.phoneDisplay}`}
      className="fixed bottom-5 right-5 z-40 block h-14 w-14 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0068FF] focus-visible:ring-offset-2 sm:bottom-6 sm:right-6"
    >
      <Image src={zaloIcon} alt="" width={56} height={56} className="h-full w-full" unoptimized />
    </a>
  );
}
