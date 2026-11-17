/**
 * Lấy IP người dùng phía sau chuỗi proxy: Cloudflare → Traefik (Coolify) → Next.js (rewrite /graphql) → API.
 *
 * Thứ tự ưu tiên:
 *  1. `CF-Connecting-IP`: Cloudflare đặt khi domain bật proxy (đám mây cam).
 *  2. `X-Real-IP`: Traefik đặt bằng IP kết nối tới nó (mặc định Traefik bỏ giá trị client tự gửi).
 *  3. Phần tử đầu của `X-Forwarded-For`.
 *  4. IP của kết nối TCP (gọi thẳng API trong mạng nội bộ).
 *
 * Lưu ý: ai gọi thẳng vào IP server (bỏ qua Cloudflare) vẫn giả được các header trên, nên IP
 * chỉ dùng cho giới hạn phụ - khoá chính chống dò mật khẩu là theo email.
 */
type HeaderValue = string | string[] | undefined;

export interface RequestLike {
  headers: Record<string, HeaderValue>;
  ip?: string;
  socket?: { remoteAddress?: string };
}

/** Lấy giá trị đầu tiên của header, cắt ngắn vì đây là dữ liệu client gửi lên. */
function firstValue(value: HeaderValue): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const candidate = raw?.split(',')[0]?.trim();
  return candidate ? candidate.slice(0, 64) : undefined;
}

export function getClientIp(req: RequestLike): string | undefined {
  return (
    firstValue(req.headers['cf-connecting-ip']) ??
    firstValue(req.headers['x-real-ip']) ??
    firstValue(req.headers['x-forwarded-for']) ??
    req.ip ??
    req.socket?.remoteAddress
  );
}
