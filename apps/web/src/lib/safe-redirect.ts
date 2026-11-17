/**
 * Chỉ cho phép chuyển hướng tới đường dẫn nội bộ sau khi đăng nhập.
 *
 * Chặn open redirect: `//evil.com`, `/\evil.com`, `https://evil.com`, `/%09/evil.com`...
 * đều trỏ ra domain khác dù có thể bắt đầu bằng "/". Trả về `fallback` nếu không an toàn.
 */
export function safeRedirectPath(value: string | null | undefined, origin: string, fallback = '/quan-tri'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;

  try {
    const url = new URL(value, origin);
    if (url.origin !== new URL(origin).origin) return fallback;
    // Dùng đường dẫn đã chuẩn hoá (đúng thứ vừa kiểm tra), không dùng chuỗi gốc
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
