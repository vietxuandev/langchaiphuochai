import type { MetadataRoute } from 'next';
import { BRAND } from '@phuochai/shared';

/**
 * Web app manifest (Next tự sinh `/manifest.webmanifest`).
 *
 * Dùng chung dữ liệu thương hiệu với `@phuochai/shared` nên tên/mô tả không bị lệch.
 * Icon nằm trong `public/icons/` (192 + 512 cho Android/PWA); favicon và apple-touch-icon
 * được Next tự chèn từ `app/favicon.ico`, `app/icon.png`, `app/apple-icon.png`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} - ${BRAND.tagline}`,
    short_name: BRAND.shortName,
    description: `Danh bạ lưu trú và cẩm nang du lịch Phước Hải: khách sạn, homestay, villa, điểm đến, ăn uống và bất động sản. Hotline ${BRAND.phoneDisplay}.`,
    lang: 'vi',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#14807f',
    categories: ['travel', 'lifestyle'],
    icons: [
      {
        src: '/icons/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/apple-touch-icon-180x180.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
