/**
 * Bộ nhận diện thương hiệu mới - nguồn duy nhất cho cả API và website.
 * Đổi domain/số điện thoại chỉ cần sửa file này (và biến môi trường tương ứng).
 */

export const BRAND = {
  /** Tên đầy đủ hiển thị ở logo, footer, metadata. */
  name: 'Làng Chài Phước Hải',
  /** Tên ngắn dùng cho logo/nhãn nhỏ. */
  shortName: 'Làng Chài',
  /** Khu vực địa lý hiển thị kèm thương hiệu. */
  area: 'Phước Hải',
  tagline: 'Danh bạ lưu trú & cẩm nang du lịch Phước Hải',
  domain: 'langchaiphuochai.com',
  /** URL công khai của website (ưu tiên biến môi trường khi triển khai). */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://langchaiphuochai.com',
  /** Hotline chính. */
  phone: '0869123020',
  phoneDisplay: '0869 123 020',
  zalo: '0869123020',
  email: 'lienhe@langchaiphuochai.com',
  address: 'Xã Phước Hải, TP. Hồ Chí Minh',
  facebook: 'https://www.facebook.com/langchaiphuochai',
} as const;

/** Thư mục lưu ảnh upload trên server mới (đường dẫn public bắt đầu bằng `/upload`). */
export const UPLOAD = {
  /** Tiền tố public của ảnh do hệ thống mới quản lý. */
  publicPrefix: '/upload',
  /** Thư mục con cho ảnh bài viết. */
  postsFolder: 'posts',
  /** Thư mục con cho ảnh danh mục. */
  categoriesFolder: 'categories',
  /** Thư mục con cho ảnh đại diện người dùng. */
  avatarsFolder: 'avatars',
  /** Dung lượng tối đa cho mỗi ảnh (byte). */
  maxBytes: 10 * 1024 * 1024,
  /** Định dạng được phép. */
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
  ] as const,
} as const;

/** Đường dẫn ảnh đầy đủ từ giá trị lưu trong DB (`/upload/...`). */
export function buildImageUrl(image: { path?: string | null } | null | undefined): string {
  if (!image?.path) return '/images/placeholder.svg';
  const path = image.path.trim();
  if (!path) return '/images/placeholder.svg';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return path.startsWith('/') ? path : `${UPLOAD.publicPrefix}/${path}`;
}
