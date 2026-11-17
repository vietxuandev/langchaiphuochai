import { timingSafeEqual } from 'node:crypto';
import type { RequestLike } from './client-ip';

/** Header web gửi kèm khi gọi API từ server của nó (ví dụ route `/api/views`). */
export const INTERNAL_SECRET_HEADER = 'x-internal-secret';

/** Đã cấu hình secret dùng chung giữa web và API chưa. */
export function hasInternalSecret(): boolean {
  return !!process.env.REVALIDATE_SECRET;
}

/**
 * Request do chính server web gửi (kèm REVALIDATE_SECRET - secret web và API đang dùng chung).
 * Dùng cho thao tác chỉ web được làm, như đếm lượt xem.
 *
 * Chưa cấu hình secret thì trả `true` để giữ hành vi cũ (lượt xem vẫn được đếm).
 */
export function isTrustedInternalRequest(req: RequestLike): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return true;

  const raw = req.headers[INTERNAL_SECRET_HEADER];
  const provided = Array.isArray(raw) ? raw[0] : raw;
  if (!provided) return false;

  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
