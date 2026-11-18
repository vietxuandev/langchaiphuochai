import { normalizeVietnamese } from '@phuochai/shared';

/** Alt chung chung kế thừa từ dữ liệu cũ - không mô tả được ảnh cho trình đọc màn hình/Google Images. */
const GENERIC_ALTS = new Set(['hinh anh', 'hinh', 'anh', 'image', 'img', 'photo', 'picture', 'thumbnail']);

/** Alt của ảnh: dùng mô tả thật nếu có, còn trống hoặc chung chung ("Hình ảnh") thì dùng `fallback`. */
export function imageAlt(alt: string | null | undefined, fallback: string): string {
  const value = alt?.trim();
  if (!value || GENERIC_ALTS.has(normalizeVietnamese(value))) return fallback;
  return value;
}
