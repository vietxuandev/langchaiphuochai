/**
 * Tiện ích dùng chung cho tính năng crawl bài mới từ website cũ (phuochai.com).
 *
 * Tận dụng lại các hàm đã port từ `phuochai-scraper` (thư mục `legacy/`) để
 * nhận diện URL, loại nội dung và slug giống hệt công cụ crawl ban đầu.
 */
import { PostType, PROVINCE_NAME, canonicalWardName, normalizeVietnamese } from '@phuochai/shared';
import { site } from './legacy/config';
import { detailId, itemTypeOfDetail, normalizeUrl, pathOf, slugOf } from './legacy/lib/urls';
import type { ItemType, LocationInfo } from './legacy/types';

/** Loại nội dung của site cũ -> PostType của website mới. */
export const POST_TYPE_BY_ITEM_TYPE: Record<ItemType, PostType> = {
  accommodation: PostType.ACCOMMODATION,
  news: PostType.NEWS,
  real_estate: PostType.REAL_ESTATE,
  page: PostType.PAGE,
};

/** Nhãn hiển thị cho từng loại nội dung (dùng trong preview). */
export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  accommodation: 'Nơi lưu trú',
  news: 'Tin tức',
  real_estate: 'Bất động sản',
  page: 'Trang thông tin',
};

/** Thông tin nhận diện một bài viết trên site cũ. */
export interface LegacyUrlInfo {
  /** URL tuyệt đối, đã chuẩn hoá (https, không query rác). */
  url: string;
  /** Đường dẫn, ví dụ `/tin-tuc/an-gi-o-phuoc-hai-166.html`. */
  path: string;
  /** `accommodation` | `news` | `real_estate` | `page` (null nếu không phải trang chi tiết). */
  itemType: ItemType | null;
  /** ID bài trên site cũ (số trong `-<id>.html`). */
  sourceId: number | null;
  /** Khoá ổn định tương ứng `Post.sourceKey`, ví dụ `news:166`. */
  sourceKey: string | null;
  /** Slug gốc trên site cũ (chưa chuẩn hoá về tiếng Việt không dấu). */
  legacySlug: string;
}

/**
 * Chuyển input của người dùng thành URL tuyệt đối của site cũ.
 * Chấp nhận: URL đầy đủ, đường dẫn bắt đầu bằng `/`, hoặc `slug-<id>.html`.
 * Trả về `null` nếu không nhận dạng được (khi đó coi như slug và sẽ tra trong danh sách).
 */
export function toLegacyUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    return normalizeUrl(value, site.baseUrl);
  }

  // Đường dẫn nội bộ của site cũ: /tin-tuc/abc-123.html, /abc-123.html
  if (value.startsWith('/')) {
    return normalizeUrl(`${site.baseUrl}${value}`, site.baseUrl);
  }

  // Tên file chi tiết: abc-123.html
  if (/^[^/\s]+-\d+\.html?$/i.test(value)) {
    return normalizeUrl(`${site.baseUrl}/${value}`, site.baseUrl);
  }

  return null;
}

/** Phân tích URL site cũ -> thông tin nhận diện bài viết. */
export function describeLegacyUrl(url: string): LegacyUrlInfo {
  const normalized = normalizeUrl(url, site.baseUrl) ?? url;
  const itemType = itemTypeOfDetail(normalized);
  const sourceId = detailId(normalized);

  return {
    url: normalized,
    path: pathOf(normalized),
    itemType,
    sourceId,
    sourceKey: itemType && sourceId !== null ? `${itemType}:${sourceId}` : null,
    legacySlug: slugOf(normalized),
  };
}

/** Đường dẫn trang chi tiết trên **website mới** (khớp với `postHref` ở frontend). */
export function postPath(type: PostType, slug: string): string {
  switch (type) {
    case PostType.ACCOMMODATION:
      return `/luu-tru/${slug}`;
    case PostType.NEWS:
      return `/tin-tuc/${slug}`;
    case PostType.REAL_ESTATE:
      return `/bat-dong-san/${slug}`;
    default:
      return `/trang/${slug}`;
  }
}

/** Chuyển tiêu đề tiếng Việt thành slug (giống cách seed chuẩn hoá slug). */
export function slugifyTitle(input: string, maxLength = 90): string {
  const base = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (base || 'bai-viet').slice(0, maxLength).replace(/-+$/g, '');
}

/** Chuẩn hoá gạch dài (em/en dash) về gạch nối, giống quy ước nội dung của site. */
export function normalizeDashes<T extends string | null | undefined>(value: T): T {
  if (typeof value !== 'string') return value;
  return value.replace(/[\u2014\u2013]/g, '-') as T;
}

/**
 * Dựng địa chỉ cho website mới từ dữ liệu địa điểm của site cũ.
 *
 * Quy ước hiện tại: địa chỉ chi tiết + xã/phường (168 đơn vị của TP.HCM),
 * tỉnh/thành cố định "Thành phố Hồ Chí Minh" - không còn quận/huyện.
 * (Sao chép logic `buildPostAddress` trong `prisma/seed.ts`.)
 */
export function buildAddressFromLegacy(location: LocationInfo | null | undefined): {
  addressRaw: string | null;
  ward: string | null;
  city: string | null;
} {
  if (!location) return { addressRaw: null, ward: null, city: null };

  const ward = canonicalWardName(location.ward) ?? canonicalWardName(location.raw) ?? null;

  const rawDetail = (location.street ?? '').trim() || (location.raw ?? '').trim();
  const parts = rawDetail
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const wardNorm = ward ? normalizeVietnamese(ward) : null;
  const wardRawNorm = location.ward ? normalizeVietnamese(location.ward) : null;
  const cityNorms = new Set<string>([normalizeVietnamese(PROVINCE_NAME)]);
  if (location.city) cityNorms.add(normalizeVietnamese(location.city));

  const isAdministrativePart = (value: string, original: string): boolean => {
    if (wardNorm === value || wardRawNorm === value) return true;
    if (value.includes('(xem ban do)')) return true;
    if (cityNorms.has(value)) return true;
    if (value.startsWith('thanh pho ho chi minh')) return true;
    if (value.startsWith('ho chi minh')) return true;
    if (value === 'tp ho chi minh' || value === 'tp.hcm' || value === 'tphcm' || value === 'hcm') return true;
    if (value === 'viet nam' || value.startsWith('viet nam')) return true;
    if (/^\d{4,6}$/.test(original.trim())) return true;
    if (canonicalWardName(original.trim())) return true;
    return false;
  };

  while (parts.length > 0) {
    const original = parts[parts.length - 1];
    if (isAdministrativePart(normalizeVietnamese(original), original)) parts.pop();
    else break;
  }

  const detail = parts.join(', ').replace(/^[,\s]+|[,\s]+$/g, '');
  return { addressRaw: detail || null, ward, city: PROVINCE_NAME };
}

/** Đếm số ảnh trong nội dung HTML (dùng cho preview). */
export function countContentImages(html: string | null | undefined): number {
  if (!html) return 0;
  return (html.match(/<img\b/gi) ?? []).length;
}


/**
 * Id của một candidate trong danh sách chờ duyệt.
 *
 * Mã hoá thẳng URL (base64url) để **không phải giữ dữ liệu trong RAM**: mỗi lần
 * import/xem chi tiết, server tải lại đúng URL đó.
 */
export function encodeCandidateId(url: string): string {
  return Buffer.from(url, 'utf8').toString('base64url');
}

/** Giải mã id candidate -> URL (null nếu không hợp lệ). */
export function decodeCandidateId(id: string): string | null {
  try {
    const url = Buffer.from(id, 'base64url').toString('utf8');
    return /^https?:\/\//i.test(url) ? url : null;
  } catch {
    return null;
  }
}

/** Kết quả bước kiểm tra: **chỉ** tiêu đề + mô tả ngắn (không đọc nội dung bài). */
export interface CandidateSummary {
  title: string;
  /** Mô tả ngắn của bài (meta description / sapo) - KHÔNG phải nội dung bài. */
  description: string | null;
  itemType: ItemType;
  /** Ảnh đại diện lấy từ `og:image` nếu trang có khai báo. */
  thumbnailUrl: string | null;
}

/** Giải mã các entity HTML thường gặp (&amp; &#39; &nbsp; ...). */
function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    const named: Record<string, string> = {
      amp: '&',
      lt: '<',
      gt: '>',
      quot: '"',
      apos: "'",
      nbsp: ' ',
      hellip: '...',
      mdash: '-',
      ndash: '-',
      rsquo: "'",
      lsquo: "'",
      rdquo: '"',
      ldquo: '"',
    };
    const lower = code.toLowerCase();
    if (lower.startsWith('#x')) return safeFromCodePoint(Number.parseInt(lower.slice(2), 16));
    if (lower.startsWith('#')) return safeFromCodePoint(Number.parseInt(lower.slice(1), 10));
    return named[lower] ?? match;
  });
}

function safeFromCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}

/** Đổi một đoạn HTML nhỏ thành text sạch (bỏ thẻ, gộp khoảng trắng, giải mã entity). */
function toText(html: string | null | undefined): string | null {
  if (!html) return null;
  const text = decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}

/** Dòng thông tin ngắn ("Giá từ:", "Mã tin: 167") không phải mô tả. */
function isNotDescription(text: string | null): boolean {
  if (!text) return true;
  const value = text.trim();
  return (
    value.length < 30 ||
    /^(giá từ|mã tin|địa chỉ|diện tích|xem\s*:)/i.test(value) ||
    /:\s*$/.test(value)
  );
}

/**
 * Đọc **duy nhất** tiêu đề + mô tả ngắn của một trang trên website cũ.
 *
 * Dùng regex trên chuỗi HTML (không dựng DOM, không quét ảnh, không đọc nội dung bài)
 * nên rất nhẹ: phù hợp để kiểm tra hàng loạt bài mới trước khi tải đầy đủ.
 */
export function parseCandidateSummary(html: string, url: string): CandidateSummary {
  const itemType = itemTypeOfDetail(url) ?? 'page';

  // ---- Tiêu đề: <h1> -> <title> -> slug ----
  const h1 = toText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  const titleTag = toText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const titleFromTag = titleTag ? titleTag.replace(/\s*[|\-].*$/, '').trim() : null;
  const title = h1 ?? titleFromTag ?? slugOf(url);

  // ---- Mô tả ngắn: meta description -> og:description -> sapo (p.mb-1) ----
  const metaContent = (attribute: string, name: string): string | null => {
    const patterns = [
      new RegExp(`<meta[^>]*${attribute}=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'),
      new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*${attribute}=["']${name}["']`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      const text = toText(match?.[1]);
      if (text) return text;
    }
    return null;
  };

  const sapo = toText(html.match(/<p[^>]*class=["'][^"']*\bmb-1\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1]);

  const description =
    [metaContent('name', 'description'), metaContent('property', 'og:description'), sapo].find(
      (text) => !isNotDescription(text),
    ) ?? null;

  // ---- Ảnh đại diện (chỉ 1 thẻ meta, không quét ảnh trong bài) ----
  const ogImage = metaContent('property', 'og:image');
  const thumbnailUrl = ogImage && /^https?:\/\//i.test(ogImage) ? ogImage : null;

  return { title, description, itemType, thumbnailUrl };
}
