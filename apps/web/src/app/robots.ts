import type { MetadataRoute } from 'next';
import { BRAND } from '@phuochai/shared';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? BRAND.siteUrl).replace(/\/$/, '');

/**
 * robots.txt (Next tự phục vụ tại `/robots.txt`).
 *
 * Chặn khu vực quản trị, trang đăng nhập và trang kết quả tìm kiếm (nội dung động,
 * không cần index). Trỏ tới sitemap để Google biết danh sách URL cần crawl.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/quan-tri', '/quan-tri/', '/dang-nhap', '/dang-ky', '/tim-kiem', '/api/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
