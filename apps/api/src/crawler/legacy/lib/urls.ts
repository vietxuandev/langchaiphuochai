/**
 * PHẦN PORT TỪ `phuochai-scraper` (dự án crawl cũ) - giữ nguyên logic parse để
 * dữ liệu crawl mới có cùng cấu trúc với dữ liệu đã import.
 *
 * Chỉ thay đổi: bỏ phần đọc/ghi file + CLI + state, và bỏ đuôi `.js` trong import
 * để chạy trong NestJS (CommonJS).
 */
/** Chuẩn hoá & phân loại URL của site nguồn. */
import { site } from '../config';
import type { Section } from '../types';

export type UrlKind = 'detail' | 'listing' | 'asset' | 'external' | 'other';

const ASSET_RE = /\.(jpg|jpeg|png|gif|webp|svg|ico|css|js|json|xml|pdf|zip|woff2?|ttf|mp4)$/i;
/** URL item: kết thúc bằng `-<id>.html`. */
const DETAIL_RE = /-\d+\.html?$/i;

/** Chuẩn hoá URL: bỏ hash, bỏ query rác, bỏ dấu `/` cuối. */
export function normalizeUrl(raw: string, base: string = site.baseUrl): string | null {
  let url: URL;
  try {
    url = new URL(raw, base);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;
  // Site nguồn có link tự tham chiếu bằng `http://` - luôn quy về https để không trùng lặp.
  if (url.hostname.replace(/^www\./, '') === new URL(site.baseUrl).hostname) {
    url.protocol = 'https:';
    url.hostname = new URL(site.baseUrl).hostname;
  }
  url.hash = '';
  // Giữ lại `page` khi phân trang, bỏ các query theo dõi.
  const keep = new URLSearchParams();
  for (const [key, value] of url.searchParams) {
    if (['page', 'p'].includes(key.toLowerCase())) keep.set(key, value);
  }
  url.search = keep.toString();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

/** URL có thuộc site nguồn không. */
export function isInternal(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host === new URL(site.baseUrl).hostname;
  } catch {
    return false;
  }
}

/** Path của URL (đã decode). */
export function pathOf(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname);
  } catch {
    return url;
  }
}

/** Bỏ query `?page=` để lấy URL danh mục gốc. */
export function withoutPage(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete(site.pageParam);
    u.searchParams.delete('p');
    u.search = u.searchParams.toString();
    return u.toString();
  } catch {
    return url;
  }
}

/** Số trang phân trang trong URL (mặc định 1). */
export function pageOf(url: string): number {
  try {
    const u = new URL(url);
    const value = u.searchParams.get(site.pageParam) ?? u.searchParams.get('p');
    const n = value ? Number.parseInt(value, 10) : 1;
    return Number.isFinite(n) && n > 0 ? n : 1;
  } catch {
    return 1;
  }
}

/** Tạo URL cho trang N của một danh mục. */
export function withPage(url: string, page: number): string {
  const u = new URL(url);
  if (page <= 1) u.searchParams.delete(site.pageParam);
  else u.searchParams.set(site.pageParam, String(page));
  return u.toString();
}

export function isDetailUrl(url: string): boolean {
  if (!isInternal(url)) return false;
  if (ASSET_RE.test(pathOf(url))) return false;
  return DETAIL_RE.test(pathOf(url)) && !isCategoryUrl(url);
}

/**
 * URL danh mục của "Nơi lưu trú": `/noi-luu-tru/<slug>-<id>.html`.
 * Đây là danh mục chứ không phải item, dù cùng đuôi `-<id>.html`.
 */
export function isCategoryUrl(url: string): boolean {
  const path = pathOf(url);
  return /^\/noi-luu-tru\/[^/]+-\d+\.html?$/i.test(path) || /^\/khach-san\/[^/]+$/i.test(path);
}

export type { Section };

/**
 * Loại nội dung của một URL item (trang chi tiết).
 * Chỉ dùng cho URL đã thoả `isDetailUrl`. Trả về null nếu không xác định được.
 */
export function itemTypeOfDetail(url: string): 'accommodation' | 'news' | 'real_estate' | 'page' | null {
  const path = pathOf(url);
  if (/^\/bat-dong-san\/[^/]+-\d+\.html?$/i.test(path)) return 'real_estate';
  if (/^\/tin-tuc\/[^/]+-\d+\.html?$/i.test(path)) return 'news';
  if (/^\/(danh-cho-du-khach|danh-cho-chu-dia-diem|ve-chung-toi)\/[^/]+-\d+\.html?$/i.test(path)) {
    return 'page';
  }
  // Item "Nơi lưu trú" nằm ngay ở gốc domain: /<slug>-<id>.html
  if (/^\/[^/]+-\d+\.html?$/i.test(path)) return 'accommodation';
  return null;
}

/** Loại nội dung mà một trang danh mục đang liệt kê. */
export function listingSectionOf(url: string): Section {
  const path = pathOf(url);
  if (/^\/tin-tuc(\/|\.html?$)/i.test(path)) return 'news';
  if (/^\/bat-dong-san(\/|\.html?$)/i.test(path)) return 'real_estate';
  if (/^\/danh-cho-du-khach|^\/danh-cho-chu-dia-diem|^\/ve-chung-toi/i.test(path)) return 'page';
  if (
    path === '/' ||
    /^\/noi-luu-tru|^\/khach-san|^\/nha-nghi|^\/homestay|^\/resort|^\/villa/i.test(path)
  ) {
    return 'accommodation';
  }
  return 'listing';
}

/** Suy ra "section" của URL dựa trên path (dùng chung cho cả item và danh mục). */
export function sectionOf(url: string): Section {
  if (isDetailUrl(url)) return itemTypeOfDetail(url) ?? 'other';
  return listingSectionOf(url);
}

export function classify(url: string): UrlKind {
  if (!isInternal(url)) return 'external';
  if (ASSET_RE.test(pathOf(url))) return 'asset';
  if (isCategoryUrl(url)) return 'listing';
  if (isDetailUrl(url)) return 'detail';
  const path = pathOf(url);
  if (path === '/' || !/\.[a-z0-9]+$/i.test(path)) return 'listing';
  return 'other';
}

/** Lấy ID số ở cuối slug: `oyster-homestay-67.html` -> 67. */
export function detailId(url: string): number | null {
  const match = pathOf(url).match(/-(\d+)\.html?$/i);
  if (!match?.[1]) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}

/** Lấy slug: `oyster-homestay-67.html` -> `oyster-homestay`. */
export function slugOf(url: string): string {
  const path = pathOf(url);
  const file = path.split('/').filter(Boolean).pop() ?? path;
  return file
    .replace(/\.html?$/i, '')
    .replace(/-\d+$/, '')
    .toLowerCase();
}

/** Danh mục cha suy ra từ path: `/tin-tuc/an-uong` -> `/tin-tuc.html`, `/oyster-homestay-67.html` -> `/`. */
export function parentListingUrl(url: string): string {
  const path = pathOf(url);
  const segments = path.split('/').filter(Boolean);
  if (segments.length <= 1) return `${site.baseUrl}/`;
  return `${site.baseUrl}/${segments.slice(0, -1).join('/')}`;
}

/** URL tuyệt đối cho đường dẫn tương đối trong HTML. */
export function absolutize(href: string, base: string): string | null {
  const value = href.trim();
  if (!value || value.startsWith('javascript:') || value.startsWith('mailto:') || value.startsWith('tel:')) {
    return null;
  }
  return normalizeUrl(value, base);
}

/** Có nằm trong danh sách prefix cho phép khi khám phá danh mục. */
export function isAllowedListingPath(url: string): boolean {
  const path = pathOf(url);
  if (site.denyPrefixes.some((prefix) => path.startsWith(prefix))) return false;
  return site.listingPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
