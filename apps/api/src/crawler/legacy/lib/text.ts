/**
 * PHẦN PORT TỪ `phuochai-scraper` (dự án crawl cũ) - giữ nguyên logic parse để
 * dữ liệu crawl mới có cùng cấu trúc với dữ liệu đã import.
 *
 * Chỉ thay đổi: bỏ phần đọc/ghi file + CLI + state, và bỏ đuôi `.js` trong import
 * để chạy trong NestJS (CommonJS).
 */
/** Tiện ích xử lý chuỗi tiếng Việt, giá, diện tích. */

const WS = /[\s\u00a0]+/g;

/** Gộp khoảng trắng, trim. Trả về null nếu rỗng. */
export function clean(input: string | null | undefined): string | null {
  if (input == null) return null;
  const out = input.replace(WS, ' ').trim();
  return out.length > 0 ? out : null;
}

/** Như `clean` nhưng luôn trả về string (rỗng thay vì null). */
export function cleanOrEmpty(input: string | null | undefined): string {
  return clean(input) ?? '';
}

/** Bỏ dấu tiếng Việt (dùng cho slug, tên file). */
export function deaccent(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** Tạo slug an toàn cho tên file / URL. */
export function slugify(input: string, maxLength = 80): string {
  const base = deaccent(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (base || 'x').slice(0, maxLength).replace(/-+$/g, '');
}

/** "1,000,000" -> 1000000 ; "17,5" -> 17.5 ; "abc" -> null */
export function parseNumber(input: string | null | undefined): number | null {
  if (!input) return null;
  const normalized = input
    .replace(/\s/g, '')
    .replace(/[^\d.,-]/g, '')
    // Bỏ dấu phân cách nghìn kiểu VN (1.234.567 hoặc 1,234,567)
    .replace(/[.,](?=\d{3}\b)/g, '');
  if (!normalized || !/\d/.test(normalized)) return null;
  const value = Number(normalized.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

export interface ParsedPrice {
  raw: string | null;
  value: number | null;
  unit: string | null;
  currency: 'VND' | null;
}

const UNIT_MULTIPLIERS: { pattern: RegExp; multiplier: number; unit: string }[] = [
  { pattern: /tỷ|ty\b|tỉ/i, multiplier: 1_000_000_000, unit: 'tỷ' },
  { pattern: /triệu|trieu|tr\b|tr\/m/i, multiplier: 1_000_000, unit: 'triệu' },
  { pattern: /nghìn|nghin|ngàn|k\b/i, multiplier: 1_000, unit: 'nghìn' },
];

/**
 * Parse giá tiếng Việt: "1,000,000", "17 tỷ", "~ 68 tr/m²", "Thỏa thuận".
 * Trả về giá trị VND nếu suy ra được.
 */
export function parsePrice(input: string | null | undefined): ParsedPrice {
  const raw = clean(input);
  if (!raw) return { raw: null, value: null, unit: null, currency: null };

  const lower = raw.toLowerCase();
  if (/thỏa thuận|thoa thuan|liên hệ|lien he/.test(lower)) {
    return { raw, value: null, unit: null, currency: null };
  }

  const numeric = parseNumber(raw);
  if (numeric == null) return { raw, value: null, unit: null, currency: null };

  for (const { pattern, multiplier, unit } of UNIT_MULTIPLIERS) {
    if (pattern.test(lower)) {
      return { raw, value: Math.round(numeric * multiplier), unit, currency: 'VND' };
    }
  }

  const isPlainVnd = /^\d[\d.,]*\s*(đ|vnd|vnđ|d)?$/i.test(raw.trim());
  if (isPlainVnd && numeric >= 1000) {
    return { raw, value: Math.round(numeric), unit: 'đ', currency: 'VND' };
  }
  return { raw, value: null, unit: null, currency: null };
}

/** Tách "Xã Phước Hải, Thành Phố Hồ Chí Minh" thành các phần địa chỉ. */
export function splitAddress(input: string | null | undefined): {
  raw: string | null;
  ward: string | null;
  district: string | null;
  city: string | null;
} {
  const raw = clean(input);
  if (!raw) return { raw: null, ward: null, district: null, city: null };
  const parts = raw
    .split(',')
    .map((p) => clean(p))
    .filter((p): p is string => !!p);

  let ward: string | null = null;
  let district: string | null = null;
  let city: string | null = null;
  // Lưu ý: không dùng `\b` ở đây - ký tự có dấu tiếng Việt không thuộc \w nên \b sẽ không khớp.
  for (const part of parts) {
    if (/^(xã|phường|thị trấn)(\s|$)/i.test(part)) ward = part;
    else if (/^(huyện|quận|thị xã|tp\.?|thành phố)(\s|$)/i.test(part)) {
      if (/^(huyện|quận|thị xã)(\s|$)/i.test(part)) district = part;
      else city = part;
    }
  }
  if (!city && parts.length > 0) {
    const last = parts[parts.length - 1];
    if (last && !/^(xã|phường|thị trấn|huyện|quận)(\s|$)/i.test(last)) city = last;
  }
  return { raw, ward, district, city };
}

/** Đếm số segment của path (dùng để giới hạn độ sâu BFS). */
export function pathDepth(url: string): number {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).length;
  } catch {
    return 0;
  }
}

/** Rút gọn chuỗi dài cho log. */
export function truncate(input: string, max = 90): string {
  return input.length <= max ? input : `${input.slice(0, max - 1)}…`;
}

/** Loại bỏ các thẻ HTML cơ bản khỏi chuỗi (dùng khi cần text thuần). */
export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
}

/** So sánh 2 mảng chuỗi không phân biệt thứ tự. */
export function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((x) => setB.has(x));
}
