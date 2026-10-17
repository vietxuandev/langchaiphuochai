// Nạp biến môi trường từ apps/api/.env khi chạy `tsx prisma/seed.ts` trực tiếp
import 'dotenv/config';

/**
 * Seed / import dữ liệu crawl (project phuochai-scraper) vào PostgreSQL qua Prisma.
 *
 * Chạy (trong apps/api):  npm run db:seed        ->  tsx prisma/seed.ts
 * Cờ hỗ trợ:
 *   --fresh     xoá toàn bộ Post / PostImage / Tag / Category trước khi import
 *   --limit=N   chỉ import N bài đầu tiên (test nhanh)
 *
 * Biến môi trường:
 *   DATASET_PATH        đường dẫn dataset.json (mặc định <repo>/data/seed/dataset.json)
 *   UPLOAD_DIR          thư mục ảnh của server mới (mặc định <repo>/data/upload)
 *   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD     (mặc định admin@langchaiphuochai.com / Admin@123)
 *   SEED_EDITOR_EMAIL / SEED_EDITOR_PASSWORD   (mặc định editor@langchaiphuochai.com / Editor@123)
 *   SEED_USER_EMAIL / SEED_USER_PASSWORD       (mặc định user@langchaiphuochai.com / User@123)
 *
 * Script idempotent: chạy lại nhiều lần chỉ cập nhật, không tạo bản ghi trùng.
 * Nếu chưa có dữ liệu: chạy `npm run data:prepare` ở gốc repo trước.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Prisma, PostStatus, PostType, Role, PrismaClient } from '@prisma/client';
import {
  PROVINCE_NAME,
  canonicalWardName,
  normalizeVietnamese,
  stripTagsBlock,
  stripTagsText,
} from '@phuochai/shared';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/* -------------------------------------------------------------------------- */
/*                        Kiểu dữ liệu nguồn (dataset.json)                   */
/* -------------------------------------------------------------------------- */

interface SourceImage {
  url?: string | null;
  role?: string | null;
  alt?: string | null;
  localPath?: string | null;
  bytes?: number | null;
  contentType?: string | null;
  sha256?: string | null;
}

interface SourceCategory {
  name: string;
  url: string;
  slug: string;
  id?: number | null;
  section?: string | null;
  parentUrl?: string | null;
  level?: number | null;
  declaredCount?: number | null;
  discoveredCount?: number | null;
  childCount?: number | null;
  isLocationFilter?: boolean | null;
  image?: SourceImage | null;
  description?: string | null;
  seoTitle?: string | null;
}

interface SourceLocation {
  raw?: string | null;
  ward?: string | null;
  district?: string | null;
  city?: string | null;
  street?: string | null;
}

interface SourcePrice {
  raw?: string | null;
  value?: number | null;
  unit?: string | null;
  currency?: string | null;
  perM2Raw?: string | null;
  perM2Value?: number | null;
}

interface SourceProperty {
  areaText?: string | null;
  areaM2?: number | null;
  widthM?: number | null;
  lengthM?: number | null;
  dimensions?: string | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  floors?: number | null;
  direction?: string | null;
  roadWidth?: string | null;
  legal?: string | null;
  attributes?: unknown;
}

interface SourceContact {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  zalo?: string | null;
  certificate?: string | null;
  experience?: string | null;
  verified?: boolean | null;
  hasManager?: boolean | null;
}

interface SourceSeo {
  title?: string | null;
  description?: string | null;
  keywords?: string | null;
  robots?: string | null;
  canonical?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  ogType?: string | null;
  ogSiteName?: string | null;
}

interface SourceItem {
  id: string;
  type: string;
  sourceId?: number | null;
  url?: string | null;
  canonicalUrl?: string | null;
  slug?: string | null;
  title?: string | null;
  seoTitle?: string | null;
  summary?: string | null;
  contentHtml?: string | null;
  contentText?: string | null;
  contentLength?: number | null;
  category?: { name?: string | null; url?: string | null; slug?: string | null } | null;
  breadcrumb?: string[];
  location?: SourceLocation | null;
  price?: SourcePrice | null;
  property?: SourceProperty | null;
  contact?: SourceContact | null;
  code?: string | null;
  views?: number | null;
  tags?: string[];
  images?: SourceImage[];
  tables?: unknown[];
  embeds?: unknown[];
  pageContacts?: unknown;
  seo?: SourceSeo | null;
  extras?: unknown;
  crawledAt?: string | null;
  htmlHash?: string | null;
  warnings?: string[];
}

interface SourceDataset {
  meta?: {
    site?: string;
    baseUrl?: string;
    generatedAt?: string;
    counts?: Record<string, number>;
  };
  categories?: SourceCategory[];
  items?: SourceItem[];
  media?: SourceImage[];
}

/* -------------------------------------------------------------------------- */
/*                                  Tiện ích                                  */
/* -------------------------------------------------------------------------- */

interface ImportStats {
  categories: number;
  categorySlugConflicts: number;
  postsCreated: number;
  postsUpdated: number;
  skipped: number;
  images: number;
  tags: number;
  mediaFound: number;
  mediaMissing: number;
  slugConflicts: number;
  byType: Record<PostType, number>;
}

/** Nhãn tiếng Việt cho từng loại nội dung (dùng khi in tổng kết). */
const POST_TYPE_LABELS: Record<PostType, string> = {
  [PostType.ACCOMMODATION]: 'Nơi lưu trú',
  [PostType.NEWS]: 'Tin tức & cẩm nang',
  [PostType.REAL_ESTATE]: 'Bất động sản',
  [PostType.PAGE]: 'Trang thông tin',
};

/** section trong dataset -> PostType. `listing` và giá trị lạ -> PAGE. */
const POST_TYPE_BY_SOURCE: Record<string, PostType> = {
  accommodation: PostType.ACCOMMODATION,
  news: PostType.NEWS,
  real_estate: PostType.REAL_ESTATE,
  page: PostType.PAGE,
  listing: PostType.PAGE,
};

function log(message: string): void {
  console.log(message);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

/** In bảng 2 cột đơn giản. */
function printTable(rows: Array<[string, string | number]>): void {
  const width = Math.max(24, ...rows.map(([label]) => label.length));
  const line = '─'.repeat(width + 12);
  log(line);
  for (const [label, value] of rows) {
    log(`${label.padEnd(width)} │ ${String(value)}`);
  }
  log(line);
}

/**
 * Bỏ dấu tiếng Việt.
 * Cố tình viết lại cục bộ (thay vì import @phuochai/shared) để seed không phụ thuộc
 * vào bước `npm run build:shared`.
 */
function deaccent(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** Tạo slug: "Homestay Phước Hải" -> "homestay-phuoc-hai" (giống @phuochai/shared). */
/**
 * Chuẩn hoá địa chỉ theo dữ liệu hành chính TP. Hồ Chí Minh (đã bỏ cấp quận/huyện):
 *  - xã/phường: về tên chuẩn trong danh mục 168 xã/phường
 *  - tỉnh/thành: luôn là "Thành phố Hồ Chí Minh"
 *  - addressRaw: chỉ giữ địa chỉ chi tiết (bỏ "Xã Phước Hải, Thành Phố Hồ Chí Minh")
 */
function buildPostAddress(location: SourceLocation | null | undefined): {
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

  /** Các phần cuối chỉ là đơn vị hành chính / quốc gia / mã bưu điện → bỏ khỏi địa chỉ chi tiết. */
  const isAdministrativePart = (value: string, original: string): boolean => {
    if (wardNorm === value || wardRawNorm === value) return true;
    if (value.includes('(xem ban do)')) return true;
    if (cityNorms.has(value)) return true;
    if (value.startsWith('thanh pho ho chi minh')) return true;
    if (value.startsWith('ho chi minh')) return true;
    if (value === 'tp ho chi minh' || value === 'tp.hcm' || value === 'tphcm' || value === 'hcm') return true;
    if (value === 'viet nam' || value.startsWith('viet nam')) return true;
    // Mã bưu điện thuần số (4-6 chữ số) hoặc "Hồ Chí Minh 78412"
    if (/^\d{4,6}$/.test(original.trim())) return true;
    // Tên một xã/phường khác trong danh mục (ví dụ "Long Hải") - cấp hành chính, không phải địa chỉ chi tiết
    if (canonicalWardName(original.trim())) return true;
    return false;
  };

  while (parts.length > 0) {
    const original = parts[parts.length - 1];
    const last = normalizeVietnamese(original);
    if (isAdministrativePart(last, original)) parts.pop();
    else break;
  }

  const detail = parts.join(', ').replace(/^[,\s]+|[,\s]+$/g, '');
  return { addressRaw: detail || null, ward, city: PROVINCE_NAME };
}

function slugify(input: string, maxLength = 90): string {
  const base = deaccent(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (base || 'bai-viet').slice(0, maxLength).replace(/-+$/g, '');
}

/**
 * Chuẩn hoá đường dẫn ảnh về dạng public của **server mới**: `/upload/...`.
 * Chấp nhận dữ liệu crawl ở các dạng: "media/news/a.jpg", "/media/news/a.jpg", "upload/..." hoặc URL cũ.
 */
function toPublicPath(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return null; // ảnh từ domain cũ: không dùng nữa

  const withoutLeadingSlash = trimmed.replace(/^\/+/, '');
  // Dữ liệu crawl lưu ảnh trong "media/..." - nay phục vụ tại "/upload/..."
  const relative = withoutLeadingSlash.replace(/^media\//i, '').replace(/^upload\//i, '');
  return `/upload/${relative}`;
}

function toIntOrNull(value?: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.trunc(value);
}

function toFloatOrNull(value?: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

function toBigIntOrNull(value?: number | null): bigint | null {
  if (value == null || !Number.isFinite(value)) return null;
  return BigInt(Math.round(value));
}

function toDateOrNull(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Giá trị JSON thô -> input Prisma. null/undefined -> DbNull (SQL NULL).
 * Không annotate kiểu trả về để TS tự suy luận `typeof Prisma.DbNull | InputJsonValue`.
 */
function jsonInput(value: unknown) {
  return value == null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

/** Thuộc tính chứa đường dẫn tài nguyên trong HTML nội dung. */
const ASSET_ATTR = /(\b(?:src|poster|data-src)\s*=\s*)(["'])([^"']*)\2/gi;
/** url(...) trong style inline. */
const CSS_URL = /url\(\s*(["']?)([^"')]+)\1\s*\)/gi;
/** Anchor bất kỳ (để xử lý link nội bộ/template cũ). */
const ANCHOR = /<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
/** Thẻ ảnh trỏ ra ngoài hệ thống mới. */
const EXTERNAL_IMG = /<img\b[^>]*src=["']https?:\/\/[^"']*["'][^>]*>/gi;

/** Domain cũ - mọi tham chiếu đều bị loại bỏ. */
const OLD_DOMAIN = /^https?:\/\/(?:www\.)?phuochai\.com/i;
/** Domain của template cũ (không còn liên quan tới thương hiệu mới). */
const LEGACY_TEMPLATE_DOMAIN =
  /^https?:\/\/(?:www\.)?(?:khachsandalat\.com|thotot\.com|nhavui\.com|nhathat\.com|nhadidong\.com|1nha\.com)/i;

export interface ContentLinkMap {
  /** Đường dẫn bài viết cũ -> đường dẫn bài viết mới (ví dụ /oyster-homestay-67.html -> /luu-tru/oyster-homestay) */
  postPath: Map<string, string>;
  /** Đường dẫn danh mục cũ -> /danh-muc/<slug mới> */
  categoryPath: Map<string, string>;
}

/** Tách path của một URL (bỏ query/hash). */
function pathOfUrl(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

/** Link tag cũ "/tags/<tên>" -> trang tìm kiếm của site mới. */
function tagSearchPath(encodedTag: string): string {
  const name = decodeURIComponent(encodedTag).replace(/^\s+|\s+$/g, '');
  return `/tim-kiem?q=${encodeURIComponent(name)}`;
}

/** Đường dẫn nội bộ của site mới? (bắt đầu bằng "/" và không phải "//host") */
function isNewSitePath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//');
}

/** Là đường dẫn tài nguyên cần chuyển sang /upload/... (ảnh, file) */
function isAssetPath(value: string): boolean {
  return (
    /^(?:media|upload)\//i.test(value) ||
    /\.(?:jpe?g|png|webp|gif|avif|svg|pdf|css|js)(?:[?#]|$)/i.test(value)
  );
}

/**
 * Viết lại toàn bộ nội dung HTML của bài viết theo thương hiệu/domain mới:
 *  - Ảnh: chỉ dùng ảnh do server mới quản lý (`/upload/...`), bỏ ảnh trỏ ra ngoài
 *  - Link nội bộ của site cũ (tuyệt đối hoặc tương đối): map sang đường dẫn mới; nếu trang
 *    không còn tồn tại thì bỏ thẻ `<a>` và giữ phần chữ
 *  - Link tag cũ: chuyển thành trang tìm kiếm của site mới
 *  - Link tới domain template cũ (khachsandalat.com...) và domain cũ: loại bỏ
 */
function rewriteContentHtml(html: string | null | undefined, links: ContentLinkMap): string | null {
  if (!html) return null;
  let output = html;

  // (1) Ảnh lấy từ nguồn ngoài: bỏ hẳn (site mới tự quản lý ảnh trong /upload)
  output = output.replace(EXTERNAL_IMG, '');

  // (2) Xử lý mọi thẻ <a>
  output = output.replace(
    ANCHOR,
    (_match, before: string, href: string, after: string, inner: string) => {
      const value = href.trim();
      const isAbsolute = /^https?:\/\//i.test(value);

      if (!isAbsolute) {
        // Link nội bộ dạng tương đối của site cũ: /tin-tuc/abc-123.html
        const mapped = links.postPath.get(value) ?? links.categoryPath.get(value);
        if (mapped) return `<a href="${mapped}"${after}>${inner}</a>`;
        if (value.startsWith('/tags/')) {
          return `<a href="${tagSearchPath(value.slice('/tags/'.length))}"${after}>${inner}</a>`;
        }
        if (isNewSitePath(value)) return `<a href="${value}"${after}>${inner}</a>`;
        return `<a href="${value}"${after}>${inner}</a>`;
      }

      // Link tuyệt đối tới domain cũ hoặc domain template cũ
      if (OLD_DOMAIN.test(value) || LEGACY_TEMPLATE_DOMAIN.test(value)) {
        const oldPath = pathOfUrl(value);
        if (oldPath.startsWith('/tags/')) {
          return `<a href="${tagSearchPath(oldPath.slice('/tags/'.length))}"${after}>${inner}</a>`;
        }
        const mapped = links.postPath.get(oldPath) ?? links.categoryPath.get(oldPath);
        if (mapped) return `<a href="${mapped}"${after}>${inner}</a>`;
        // Trang cũ không còn trên site mới -> bỏ liên kết, giữ nội dung chữ
        return inner;
      }

      // Link ngoài hợp lệ khác: giữ nguyên
      return `<a${before}href="${value}"${after}>${inner}</a>`;
    },
  );

  // (3) Các thuộc tính tài nguyên còn lại (src/poster/data-src)
  output = output.replace(ASSET_ATTR, (match, prefix: string, quote: string, value: string) => {
    const trimmed = value.trim();
    if (!trimmed || /^(?:data:|#|mailto:|tel:|\/\/)/i.test(trimmed)) return match;

    if (/^https?:\/\//i.test(trimmed)) {
      // Ảnh/tài nguyên ngoài hệ thống mới: chỉ giữ nếu đã nằm trong /upload
      const mapped = toPublicPath(pathOfUrl(trimmed));
      return mapped && isAssetPath(mapped) ? `${prefix}${quote}${mapped}${quote}` : '';
    }

    if (isNewSitePath(trimmed)) return match; // đường dẫn nội bộ site mới: giữ nguyên

    if (isAssetPath(trimmed)) {
      return `${prefix}${quote}${toPublicPath(trimmed) ?? trimmed}${quote}`;
    }
    return match;
  });

  // (4) url(...) trong style inline
  output = output.replace(CSS_URL, (match, quote: string, value: string) => {
    const trimmed = value.trim();
    if (/^(?:https?:)?\/\/|^data:/i.test(trimmed)) return match;
    if (isNewSitePath(trimmed)) return match;
    return `url(${quote}${toPublicPath(trimmed) ?? trimmed}${quote})`;
  });

  return output;
}

/** Chọn slug chưa bị chiếm: ưu tiên slug mong muốn -> slug cũ -> thêm hậu tố. */
function pickFreeSlug(
  preferred: string,
  previousSlug: string | null | undefined,
  fallbackBase: string,
  used: Set<string>,
): string {
  if (!used.has(preferred)) return preferred;
  if (previousSlug && !used.has(previousSlug)) return previousSlug;
  const base = fallbackBase || preferred;
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

/* -------------------------------------------------------------------------- */
/*                     Cờ dòng lệnh & đường dẫn dữ liệu                       */
/* -------------------------------------------------------------------------- */

const ARGS = process.argv.slice(2);
const FRESH = ARGS.includes('--fresh');

/** Đọc giá trị của cờ dạng --ten=gia-tri. */
function readArgValue(name: string): string | null {
  const prefix = `${name}=`;
  const found = ARGS.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

const limitRaw = readArgValue('--limit');
const LIMIT = limitRaw && /^\d+$/.test(limitRaw) ? Number.parseInt(limitRaw, 10) : 0;
if (limitRaw !== null && LIMIT === 0) {
  log(`⚠️  Bỏ qua cờ --limit=${limitRaw} (phải là số nguyên dương). Import toàn bộ.`);
}

/**
 * Tìm dataset.json theo thứ tự: DATASET_PATH -> <cwd>/../../data/seed (chạy trong apps/api)
 * -> <cwd>/data/seed (chạy ở gốc repo) -> theo vị trí file seed.
 */
function resolveDatasetPath(): string {
  const fromEnv = process.env.DATASET_PATH?.trim();
  if (fromEnv) {
    const resolved = path.resolve(fromEnv);
    if (existsSync(resolved)) return resolved;
    throw new Error(
      [
        `Không tìm thấy dataset.json tại DATASET_PATH: ${resolved}`,
        '',
        '👉 Hãy chạy trước (ở gốc repo): npm run data:prepare',
      ].join('\n'),
    );
  }

  const candidates = [
    path.resolve(process.cwd(), '../../data/seed/dataset.json'),
    path.resolve(process.cwd(), 'data/seed/dataset.json'),
    path.resolve(__dirname, '../../../data/seed/dataset.json'),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (found) return found;

  throw new Error(
    [
      'Không tìm thấy file dataset.json. Đã thử:',
      ...candidates.map((candidate) => `  - ${candidate}`),
      '',
      '👉 Hãy chạy trước (ở gốc repo): npm run data:prepare',
    ].join('\n'),
  );
}

function readDataset(datasetPath: string): SourceDataset {
  const raw = readFileSync(datasetPath, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || !Array.isArray((parsed as SourceDataset).items)) {
    throw new Error(`dataset.json không đúng định dạng (thiếu mảng "items"): ${datasetPath}`);
  }
  return parsed as SourceDataset;
}

/** Thư mục gốc chứa dữ liệu (data/) - mặc định cạnh dataset.json. */
function resolveUploadDir(datasetPath: string): string {
  const fromEnv = process.env.UPLOAD_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(path.dirname(datasetPath), '..', 'upload');
}

/* -------------------------------------------------------------------------- */
/*                              Các bước import                               */
/* -------------------------------------------------------------------------- */

const SEED_USERS = [
  {
    email: process.env.SEED_ADMIN_EMAIL?.trim() || 'admin@langchaiphuochai.com',
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin@123',
    name: 'Quản trị viên',
    role: Role.ADMIN,
    bio: 'Tài khoản quản trị website Làng Chài Phước Hải.',
  },
  {
    email: process.env.SEED_EDITOR_EMAIL?.trim() || 'editor@langchaiphuochai.com',
    password: process.env.SEED_EDITOR_PASSWORD || 'Editor@123',
    name: 'Biên tập viên',
    role: Role.EDITOR,
    bio: 'Tài khoản biên tập nội dung.',
  },
  {
    email: process.env.SEED_USER_EMAIL?.trim() || 'user@langchaiphuochai.com',
    password: process.env.SEED_USER_PASSWORD || 'User@123',
    name: 'Thành viên',
    role: Role.USER,
    bio: 'Tài khoản thành viên thường.',
  },
] as const;

/** Tạo/cập nhật 3 tài khoản mặc định, trả về id tài khoản ADMIN. */
async function seedUsers(): Promise<string> {
  log('1) Tài khoản người dùng');
  let adminId = '';

  for (const user of SEED_USERS) {
    const passwordHash = await bcrypt.hash(user.password, 10);

    const row = await prisma.user.upsert({
      where: { email: user.email },
      create: {
        email: user.email,
        name: user.name,
        passwordHash,
        role: user.role,
        bio: user.bio,
        isActive: true,
      },
      // Seed luôn đặt lại mật khẩu theo env để môi trường dev luôn đăng nhập được.
      update: { name: user.name, passwordHash, role: user.role, isActive: true },
      select: { id: true },
    });
    if (user.role === Role.ADMIN) adminId = row.id;
    log(`   ✓ ${user.email} (${user.role})`);
  }

  if (!adminId) throw new Error('Không tạo được tài khoản ADMIN.');
  return adminId;
}

/** Xoá dữ liệu cũ khi chạy với cờ --fresh. */
async function resetContent(): Promise<void> {
  log('🧹 --fresh: xoá dữ liệu nội dung cũ...');
  const images = await prisma.postImage.deleteMany();
  const posts = await prisma.post.deleteMany();
  const tags = await prisma.tag.deleteMany();
  const categories = await prisma.category.deleteMany();
  log(
    `   ✓ Đã xoá ${formatNumber(posts.count)} bài, ${formatNumber(images.count)} ảnh, ` +
      `${formatNumber(tags.count)} tag, ${formatNumber(categories.count)} danh mục`,
  );
}

/**
 * Import danh mục theo đúng cây: sắp xếp theo level tăng dần để cha có trước con.
 * Trả về map sourceUrl -> categoryId (dùng để gán categoryId cho bài viết).
 */
async function importCategories(
  categories: SourceCategory[],
  stats: ImportStats,
): Promise<{ urlToId: Map<string, string>; pathBySourcePath: Map<string, string> }> {
  log('\n2) Danh mục');
  const urlToId = new Map<string, string>();
  /** Đường dẫn danh mục trên site cũ -> /danh-muc/<slug mới> (dùng để viết lại link trong bài viết). */
  const pathBySourcePath = new Map<string, string>();

  if (categories.length === 0) {
    log('   (dataset không có danh mục nào)');
    return { urlToId, pathBySourcePath };
  }

  const existing = await prisma.category.findMany({
    select: { id: true, slug: true, name: true, section: true },
  });
  /** Slug đã tồn tại trong DB - dùng để nhận diện lại danh mục khi import lại (idempotent). */
  const existingSlugs = new Set(existing.map((row) => row.slug));
  /**
   * Danh mục được nhận diện theo **(tên + nhóm)**, không chỉ theo slug.
   *
   * Lý do: dataset có 2 danh mục cùng tên "Homestay" ở 2 nhóm khác nhau. Nếu chỉ so slug thì
   * mỗi lần import lại, danh mục thứ hai sẽ bị cấp slug mới (`homestay-2`, `homestay-3`, …)
   * và sinh ra bản trùng lặp, kéo theo bài viết bị gán sang bản mới.
   */
  const slugByIdentity = new Map<string, string>();
  for (const row of existing) {
    const key = `${row.name}|${row.section}`;
    if (!slugByIdentity.has(key)) slugByIdentity.set(key, row.slug);
  }
  /** Slug đã cấp trong lần chạy này. */
  const usedSlugs = new Set<string>();

  // Cha (level nhỏ) trước, con sau - giữ nguyên thứ tự gốc khi cùng level.
  /**
   * Thứ tự tạo danh mục: theo cấp (cha trước con), và trong cùng cấp thì ưu tiên
   * NƠI LƯU TRÚ > TIN TỨC > BẤT ĐỘNG SẢN > TRANG TĨNH - nhờ vậy các danh mục chính
   * (Homestay, Khách sạn, Villa...) nhận được slug sạch, danh mục trùng tên ở nhóm khác
   * sẽ tự động thêm hậu tố.
   */
  const sectionPriority: Record<string, number> = {
    accommodation: 0,
    news: 1,
    real_estate: 2,
    page: 3,
    listing: 4,
  };
  const ordered = categories
    .map((category, index) => ({ category, index }))
    .sort(
      (a, b) =>
        (a.category.level ?? 0) - (b.category.level ?? 0) ||
        (sectionPriority[a.category.section ?? ''] ?? 9) - (sectionPriority[b.category.section ?? ''] ?? 9) ||
        a.index - b.index,
    )
    .map((entry) => entry.category);

  const sortCounters = new Map<PostType, number>();
  let renamed = 0;
  let unresolvedParents = 0;

  for (const category of ordered) {
    const section = POST_TYPE_BY_SOURCE[category.section ?? ''] ?? PostType.PAGE;
    // Slug ưu tiên sinh từ TÊN danh mục (sạch, tốt cho SEO) thay vì slug URL gốc
    // (slug gốc của nơi lưu trú có kèm ID, ví dụ "homestay-37").
    const nameSlug = slugify(category.name, 80);
    const sourceSlug = category.slug?.trim() || nameSlug;
    const preferred = nameSlug || sourceSlug;

    // 1) Danh mục đã có trong DB với đúng (tên + nhóm) ⇒ dùng lại slug cũ (idempotent).
    const identity = `${category.name}|${section}`;
    let slug = slugByIdentity.get(identity) ?? null;
    if (slug && usedSlugs.has(slug)) {
      // Dataset có 2 mục trùng cả tên lẫn nhóm ⇒ mục thứ hai cần slug riêng.
      slug = null;
    }

    // 2) Chưa có: dùng slug sạch nếu còn trống, nếu không thì thêm hậu tố.
    if (!slug) {
      slug =
        !usedSlugs.has(preferred) && existingSlugs.has(preferred)
          ? preferred
          : pickFreeSlug(preferred, null, sourceSlug, new Set([...usedSlugs, ...existingSlugs]));
    }
    if (slug !== preferred) renamed += 1;

    const sortOrder = sortCounters.get(section) ?? 0;
    sortCounters.set(section, sortOrder + 1);

    // Cha phải được tạo trước (đã sắp theo level) - nếu không thấy thì để trống.
    const parentId = category.parentUrl ? urlToId.get(category.parentUrl) ?? null : null;
    if (category.parentUrl && !parentId) unresolvedParents += 1;

    const payload = {
      name: normalizeDashes(category.name),
      slug,
      section,
      description: normalizeDashes(category.description ?? null),
      seoTitle: normalizeDashes(category.seoTitle ?? null),
      imagePath: toPublicPath(category.image?.localPath),
      level: toIntOrNull(category.level) ?? 0,
      sortOrder,
      declaredCount: toIntOrNull(category.declaredCount),
      discoveredCount: toIntOrNull(category.discoveredCount),
      childCount: toIntOrNull(category.childCount) ?? 0,
      isLocationFilter: category.isLocationFilter ?? false,
      parentId,
    };

    const row = await prisma.category.upsert({
      where: { slug },
      create: payload,
      update: payload,
      select: { id: true, slug: true },
    });

    urlToId.set(category.url, row.id);
    try {
      pathBySourcePath.set(new URL(category.url).pathname, `/danh-muc/${row.slug}`);
    } catch {
      // Bỏ qua URL không hợp lệ
    }
    usedSlugs.add(slug);
    slugByIdentity.set(identity, slug);
    stats.categories += 1;
  }

  stats.categorySlugConflicts = renamed;
  log(`   ✓ ${formatNumber(stats.categories)} danh mục (${renamed} danh mục phải đổi slug do trùng)`);
  if (unresolvedParents > 0) {
    log(`   ⚠️  ${unresolvedParents} danh mục không tìm được cha (level có thể sai thứ tự) - để parentId = null`);
  }
  return { urlToId, pathBySourcePath };
}

/** Tạo/cập nhật Tag theo slug, có cache để không upsert lặp lại. */
async function createTagResolver(stats: ImportStats): Promise<(name: string) => Promise<string | null>> {
  const cache = new Map<string, string>();

  return async (name: string): Promise<string | null> => {
    const trimmed = normalizeDashes(name.trim());
    if (!trimmed) return null;
    const slug = slugify(trimmed, 60);
    const cached = cache.get(slug);
    if (cached) return cached;

    const row = await prisma.tag.upsert({
      where: { slug },
      create: { name: trimmed, slug },
      // Cập nhật lại name (idempotent, tránh nhánh update rỗng của upsert).
      update: { name: trimmed },
      select: { id: true },
    });
    cache.set(slug, row.id);
    stats.tags = cache.size;
    return row.id;
  };
}


/**
 * Chuẩn hoá dấu gạch dài (em dash U+2014, en dash U+2013) thành gạch nối "-".
 * Gạch dài trong nội dung trông "máy móc"; website dùng gạch nối thường.
 */
function normalizeDashes<T extends string | null | undefined>(value: T): T {
  if (typeof value !== 'string') return value;
  return value.replace(/[\u2014\u2013]/g, '-') as T;
}

/** Dựng phần scalar của Post (dùng chung cho create & update). */
function buildPostScalars(options: {
  item: SourceItem;
  slug: string;
  categoryId: string | null;
  authorId: string;
  links: ContentLinkMap;
}) {
  const { item, slug, categoryId, authorId, links } = options;
  const location = item.location ?? {};
  const price = item.price ?? null;
  const property = item.property ?? null;
  const contact = item.contact ?? {};
  const seo = item.seo ?? null;
  const tags = (item.tags ?? []).map((tag) => tag.trim()).filter(Boolean);

  return {
    sourceKey: item.id,
    type: POST_TYPE_BY_SOURCE[item.type] ?? PostType.PAGE,
    status: PostStatus.PUBLISHED,
    slug,
    title: normalizeDashes(item.title?.trim() || slug),
    seoTitle: normalizeDashes(item.seoTitle?.trim() || seo?.title || null),
    summary: normalizeDashes(item.summary?.trim() || seo?.description || null),
    // Bỏ khối "Tags: ..." ở cuối bài: tag đã được import thành quan hệ Post.tags riêng.
    contentHtml: normalizeDashes(stripTagsBlock(rewriteContentHtml(item.contentHtml, links))),
    contentText: normalizeDashes(stripTagsText(item.contentText ?? null)),
    htmlHash: item.htmlHash ?? null,
    code: item.code?.trim() || null,
    views: toIntOrNull(item.views) ?? 0,

    ...buildPostAddress(location),

    priceRaw: price?.raw ?? null,
    priceValue: toBigIntOrNull(price?.value),
    priceUnit: price?.unit ?? null,
    currency: price?.currency ?? 'VND',
    pricePerM2Raw: price?.perM2Raw ?? null,
    pricePerM2Value: toBigIntOrNull(price?.perM2Value),

    areaM2: toFloatOrNull(property?.areaM2),
    areaText: property?.areaText ?? null,
    widthM: toFloatOrNull(property?.widthM),
    lengthM: toFloatOrNull(property?.lengthM),
    dimensions: property?.dimensions ?? null,
    bedrooms: toIntOrNull(property?.bedrooms),
    bathrooms: toIntOrNull(property?.bathrooms),
    floors: toIntOrNull(property?.floors),
    direction: property?.direction ?? null,
    roadWidth: property?.roadWidth ?? null,
    legal: property?.legal ?? null,
    attributes: jsonInput(property?.attributes),

    contactName: contact.name ?? null,
    contactPhone: contact.phone ?? null,
    contactEmail: contact.email ?? null,
    contactZalo: contact.zalo ?? null,
    contactCertificate: contact.certificate ?? null,
    contactExperience: contact.experience ?? null,
    verified: contact.verified ?? null,
    hasManager: contact.hasManager ?? null,

    seo: jsonInput(seo),
    extras: jsonInput(item.extras),
    warnings: item.warnings ?? [],
    tagsText: tags,

    categoryId,
    authorId,

    publishedAt: toDateOrNull(item.crawledAt) ?? new Date(),
  };
}

/** Ảnh của bài: ảnh hero lên đầu, sortOrder theo thứ tự sau khi sắp xếp. */
/**
 * Ảnh của bài viết: **chỉ** lưu ảnh do server mới quản lý (`/upload/...`).
 * Ảnh trỏ ra domain cũ bị bỏ hoàn toàn; ảnh hero được đưa lên đầu.
 */
function buildImages(item: SourceItem, postId: string): Prisma.PostImageCreateManyInput[] {
  const withPath = (item.images ?? [])
    .map((image) => ({ image, path: toPublicPath(image.localPath) ?? toPublicPath(image.url) }))
    .filter((entry): entry is { image: SourceImage; path: string } => Boolean(entry.path));

  const ordered = [
    ...withPath.filter((entry) => entry.image.role === 'hero'),
    ...withPath.filter((entry) => entry.image.role !== 'hero'),
  ];

  return ordered.map(({ image, path }, index) => ({
    postId,
    path,
    role: image.role?.trim() || (index === 0 ? 'hero' : 'gallery'),
    alt: image.alt ?? null,
    bytes: toIntOrNull(image.bytes),
    sha256: image.sha256 ?? null,
    sortOrder: index,
  }));
}

/** Đếm số file media tham chiếu đã có trên đĩa (không copy - việc đó do prepare-data.mjs). */
function countAvailableMedia(items: SourceItem[], uploadDir: string): { found: number; missing: number } {
  const dataRoot = path.resolve(uploadDir, '..');
  const paths = new Set<string>();
  for (const item of items) {
    for (const image of item.images ?? []) {
      const publicPath = toPublicPath(image.localPath) ?? toPublicPath(image.url);
      if (publicPath) paths.add(publicPath.replace(/^\/+/, ''));
    }
  }

  let found = 0;
  let missing = 0;
  for (const localPath of paths) {
    if (existsSync(path.join(dataRoot, localPath))) found += 1;
    else missing += 1;
  }
  return { found, missing };
}

/** Chọn slug cho toàn bộ bài viết trước khi ghi DB để tránh đụng unique. */
function planPostSlugs(items: SourceItem[], existing: Array<{ sourceKey: string | null; slug: string }>): Map<string, string> {
  const datasetKeys = new Set(items.map((item) => item.id));
  // Bài "ngoài dataset" (do người dùng tạo) phải được giữ chỗ slug.
  const used = new Set(
    existing.filter((post) => !post.sourceKey || !datasetKeys.has(post.sourceKey)).map((post) => post.slug),
  );
  const previousByKey = new Map(
    existing.filter((post) => post.sourceKey).map((post) => [post.sourceKey as string, post.slug]),
  );

  const planned = new Map<string, string>();
  items.forEach((item, index) => {
    const preferred = item.slug?.trim() || slugify(item.title ?? item.id);
    const suffix = item.sourceId != null ? String(item.sourceId) : String(index + 1);
    const slug = pickFreeSlug(preferred, previousByKey.get(item.id), `${preferred}-${suffix}`, used);
    planned.set(item.id, slug);
    used.add(slug);
  });
  return planned;
}

/** Import bài viết + ảnh + tag. */
async function importPosts(options: {
  items: SourceItem[];
  datasetTotal: number;
  urlToCategoryId: Map<string, string>;
  categoryPathBySourcePath: Map<string, string>;
  authorId: string;
  stats: ImportStats;
}): Promise<void> {
  const { items, datasetTotal, urlToCategoryId, categoryPathBySourcePath, authorId, stats } = options;
  log('\n3) Bài viết');

  const existing = await prisma.post.findMany({ select: { sourceKey: true, slug: true } });
  const existingKeys = new Set(existing.map((post) => post.sourceKey).filter((key): key is string => Boolean(key)));
  const slugPlan = planPostSlugs(items, existing);
  const resolveTag = await createTagResolver(stats);

  /**
   * Bản đồ đường dẫn cũ -> đường dẫn mới, dùng để viết lại link nội bộ trong nội dung bài viết
   * (mọi link trỏ về domain cũ đều được chuyển sang site mới hoặc bị loại bỏ).
   */
  const links: ContentLinkMap = {
    postPath: new Map<string, string>(),
    categoryPath: categoryPathBySourcePath,
  };
  for (const item of items) {
    if (!item.url) continue;
    const slug = slugPlan.get(item.id) ?? slugify(item.title ?? item.id);
    const section =
      item.type === 'news' ? '/tin-tuc' : item.type === 'real_estate' ? '/bat-dong-san' : item.type === 'page' ? '/trang' : '/luu-tru';
    try {
      links.postPath.set(new URL(item.url).pathname, `${section}/${slug}`);
    } catch {
      // Bỏ qua URL không hợp lệ
    }
  }

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const slug = slugPlan.get(item.id) ?? slugify(item.title ?? item.id);
    const preferred = item.slug?.trim() || slugify(item.title ?? item.id);
    if (slug !== preferred) stats.slugConflicts += 1;

    // Tra danh mục theo URL gốc; không tìm thấy thì để trống (không làm hỏng import).
    const categoryUrl = item.category?.url;
    const categoryId = categoryUrl ? urlToCategoryId.get(categoryUrl) ?? null : null;

    const scalars = buildPostScalars({ item, slug, categoryId, authorId, links });
    const post = await prisma.post.upsert({
      where: { sourceKey: item.id },
      create: scalars,
      update: scalars,
      select: { id: true },
    });

    if (existingKeys.has(item.id)) {
      stats.postsUpdated += 1;
    } else {
      stats.postsCreated += 1;
      existingKeys.add(item.id);
    }
    stats.byType[scalars.type] += 1;

    // Ảnh: xoá hết rồi tạo lại để chạy lại vẫn idempotent.
    await prisma.postImage.deleteMany({ where: { postId: post.id } });
    const images = buildImages(item, post.id);
    if (images.length > 0) {
      await prisma.postImage.createMany({ data: images });
    }
    stats.images += images.length;

    // Tag: upsert theo slug rồi set lại toàn bộ danh sách cho bài.
    const tagIds: string[] = [];
    for (const tagName of item.tags ?? []) {
      const tagId = await resolveTag(tagName);
      if (tagId && !tagIds.includes(tagId)) tagIds.push(tagId);
    }
    await prisma.post.update({
      where: { id: post.id },
      data: { tags: { set: tagIds.map((id) => ({ id })) } },
    });

    const done = index + 1;
    if (done % 50 === 0 || done === items.length) {
      log(`   Đã import ${done}/${items.length} bài... (tổng dataset: ${datasetTotal})`);
    }
  }
}

/** Ghi bản ghi ImportRun (tạo lúc bắt đầu, cập nhật số liệu khi kết thúc). */
async function finishImportRun(options: {
  runId: string;
  datasetTotal: number;
  stats: ImportStats;
  notes: string;
}): Promise<void> {
  const { runId, datasetTotal, stats, notes } = options;
  await prisma.importRun.update({
    where: { id: runId },
    data: {
      totalItems: datasetTotal,
      created: stats.postsCreated,
      updated: stats.postsUpdated,
      skipped: stats.skipped,
      mediaCopied: stats.mediaFound,
      notes,
      finishedAt: new Date(),
    },
  });
}

/* -------------------------------------------------------------------------- */
/*                                   Luồng chính                              */
/* -------------------------------------------------------------------------- */

async function runImport(): Promise<void> {
  const stats: ImportStats = {
    categories: 0,
    categorySlugConflicts: 0,
    postsCreated: 0,
    postsUpdated: 0,
    skipped: 0,
    images: 0,
    tags: 0,
    mediaFound: 0,
    mediaMissing: 0,
    slugConflicts: 0,
    byType: {
      [PostType.ACCOMMODATION]: 0,
      [PostType.NEWS]: 0,
      [PostType.REAL_ESTATE]: 0,
      [PostType.PAGE]: 0,
    },
  };

  const datasetPath = resolveDatasetPath();
  const uploadDir = resolveUploadDir(datasetPath);
  const dataset = readDataset(datasetPath);

  const rawItems = dataset.items ?? [];
  // Bài thiếu id không upsert được theo sourceKey -> bỏ qua và đếm vào `skipped`.
  const allItems = rawItems.filter((item) => Boolean(item?.id));
  const invalidItems = rawItems.length - allItems.length;
  const items = LIMIT > 0 ? allItems.slice(0, LIMIT) : allItems;
  const categories = dataset.categories ?? [];
  const relativeDatasetPath = path.relative(process.cwd(), datasetPath);
  const datasetTotal = rawItems.length;
  stats.skipped = invalidItems;

  log('📥 Import dữ liệu crawl vào PostgreSQL');
  log(`   Dataset      : ${relativeDatasetPath}`);
  log(`   Ảnh upload   : ${path.relative(process.cwd(), uploadDir)}`);
  log(`   Bài viết     : ${formatNumber(items.length)} / ${formatNumber(allItems.length)}`);
  log(`   Danh mục     : ${formatNumber(categories.length)}`);
  if (dataset.meta?.generatedAt) log(`   Crawl lúc    : ${dataset.meta.generatedAt}`);
  if (invalidItems > 0) log(`   ⚠️  ${formatNumber(invalidItems)} bài thiếu id sẽ bị bỏ qua.`);
  if (LIMIT > 0) log(`   ⚠️  Chế độ --limit=${LIMIT}: chỉ import ${items.length} bài đầu.`);
  log('');

  // Bản ghi theo dõi phiên import (tạo trước, cập nhật sau).
  const run = await prisma.importRun.create({
    data: {
      source: 'phuochai-scraper',
      datasetPath: relativeDatasetPath,
      totalItems: datasetTotal,
      notes: `Đang import${LIMIT > 0 ? ` (--limit=${LIMIT})` : ''}${FRESH ? ' (--fresh)' : ''}...`,
    },
    select: { id: true },
  });

  if (FRESH) {
    await resetContent();
    log('');
  }

  const authorId = await seedUsers();
  const { urlToId: urlToCategoryId, pathBySourcePath: categoryPathBySourcePath } =
    await importCategories(categories, stats);
  await importPosts({
    items,
    datasetTotal,
    urlToCategoryId,
    categoryPathBySourcePath,
    authorId,
    stats,
  });

  // mediaCopied = số file media được tham chiếu và đã có sẵn trên đĩa
  // (việc copy media do `scripts/prepare-data.mjs` thực hiện).
  const media = countAvailableMedia(items, uploadDir);
  stats.mediaFound = media.found;
  stats.mediaMissing = media.missing;

  const notes = [
    `dataset=${relativeDatasetPath}`,
    `limit=${LIMIT}`,
    `fresh=${FRESH}`,
    `danh_mục=${stats.categories}`,
    `đổi-slug-danh-mục=${stats.categorySlugConflicts}`,
    `đổi-slug-bài=${stats.slugConflicts}`,
    `tag=${stats.tags}`,
    `media-có=${media.found}`,
    `media-thiếu=${media.missing}`,
  ].join(' | ');

  await finishImportRun({ runId: run.id, datasetTotal, stats, notes });

  /* ------------------------------- Tổng kết ------------------------------- */
  const [dbCategories, dbPosts, dbImages, dbTags] = await Promise.all([
    prisma.category.count(),
    prisma.post.count(),
    prisma.postImage.count(),
    prisma.tag.count(),
  ]);

  log('\n📊 TỔNG KẾT');
  printTable([
    ['Danh mục import', formatNumber(stats.categories)],
    ['Danh mục trong DB', formatNumber(dbCategories)],
    ['Bài tạo mới', formatNumber(stats.postsCreated)],
    ['Bài cập nhật', formatNumber(stats.postsUpdated)],
    ['Bài bỏ qua', formatNumber(stats.skipped)],
    ['Bài trong DB', formatNumber(dbPosts)],
    ['Ảnh đã ghi', formatNumber(stats.images)],
    ['Ảnh trong DB', formatNumber(dbImages)],
    ['Tag trong DB', formatNumber(dbTags)],
    ['File media có trên đĩa', `${formatNumber(stats.mediaFound)} (thiếu ${formatNumber(stats.mediaMissing)})`],
    ['Slug bài phải đổi', formatNumber(stats.slugConflicts)],
    ['Slug danh mục phải đổi', formatNumber(stats.categorySlugConflicts)],
  ]);

  log(' Số bài theo loại');
  const byTypeRows = (Object.keys(stats.byType) as PostType[]).map(
    (type): [string, string] => [POST_TYPE_LABELS[type], formatNumber(stats.byType[type])],
  );
  printTable(byTypeRows);

  if (stats.mediaMissing > 0) {
    log(
      `\n⚠️  Có ${formatNumber(stats.mediaMissing)} file media chưa có trên đĩa - ` +
        'hãy chạy `npm run data:prepare` ở gốc repo để copy đủ ảnh.',
    );
  }
}

/** Điểm vào: luôn ngắt kết nối Prisma, thoát mã 1 khi thất bại. */
async function main(): Promise<void> {
  try {
    await runImport();
    log('\n✅ Import hoàn tất.');
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  console.error('\n❌ Import thất bại:', error instanceof Error ? error.message : error);
  if (error instanceof Error && error.stack) console.error(error.stack);
  process.exit(1);
});
