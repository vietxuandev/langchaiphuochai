/**
 * PHẦN PORT TỪ `phuochai-scraper` (dự án crawl cũ) - giữ nguyên logic parse để
 * dữ liệu crawl mới có cùng cấu trúc với dữ liệu đã import.
 *
 * Chỉ thay đổi: bỏ phần đọc/ghi file + CLI + state, và bỏ đuôi `.js` trong import
 * để chạy trong NestJS (CommonJS).
 */
/**
 * Kiểu dữ liệu chuẩn (canonical schema) của toàn bộ dữ liệu trích xuất từ phuochai.com.
 *
 * Đây là "hợp đồng dữ liệu" (data contract) giữa công cụ crawl và website mới:
 * website mới chỉ cần import `dataset.json` (hoặc `items.jsonl`) và map sang model của mình.
 */

/** Loại nội dung trên site nguồn. */
export type ItemType =
  | 'accommodation' // Nơi lưu trú (khách sạn, homestay, villa, ...) - URL gốc /<slug>-<id>.html
  | 'news' // Tin tức / cẩm nang - /tin-tuc/<slug>-<id>.html
  | 'real_estate' // Bất động sản - /bat-dong-san/<slug>-<id>.html
  | 'page'; // Trang tĩnh (giới thiệu, FAQ, bảng giá, ...) - /danh-cho-*/..., /ve-chung-toi/...

/** Nhóm nội dung dùng khi phân loại URL/trang. */
export type Section = 'accommodation' | 'news' | 'real_estate' | 'page' | 'listing' | 'other';

/** Vai trò của một ảnh trong bài. */
export type MediaRole = 'hero' | 'gallery' | 'content' | 'category' | 'logo' | 'other';

/** Một ảnh/tài nguyên media gắn với item hoặc category. */
export interface MediaRef {
  /** URL tuyệt đối trên site nguồn. */
  url: string;
  role: MediaRole;
  alt?: string | null;
  /** Đường dẫn tương đối sau khi tải về (so với thư mục export), ví dụ `media/accommodation/oyster-homestay-1.jpg`. */
  localPath?: string | null;
  contentType?: string | null;
  bytes?: number | null;
  sha256?: string | null;
}

/** Bản ghi media độc lập trong manifest (đã dedupe theo URL). */
export interface MediaAsset {
  url: string;
  localPath: string | null;
  filename: string | null;
  contentType: string | null;
  bytes: number | null;
  sha256: string | null;
  status: 'downloaded' | 'skipped' | 'failed';
  error?: string | null;
  /** Các item/category đang dùng ảnh này. */
  usedBy: string[];
}

/** Danh mục (category) trên site nguồn. */
export interface CategoryRef {
  name: string;
  url: string;
  slug: string;
  /** ID danh mục nếu URL có dạng `<slug>-<id>.html`. */
  id: number | null;
}

/** Một node danh mục trong cây danh mục. */
export interface CategoryRecord extends CategoryRef {
  section: ItemType | 'listing';
  /** URL danh mục cha (null nếu là danh mục gốc). */
  parentUrl: string | null;
  /** Cấp trong cây: 0 = gốc. */
  level: number;
  /**
   * Số item mà site công bố cho danh mục này (badge trên menu danh mục).
   * Chỉ có ý nghĩa với danh mục cấp >= 1; danh mục gốc để null.
   */
  declaredCount: number | null;
  /** Số danh mục con trực tiếp. */
  childCount: number;
  /**
   * true nếu đây là trang lọc theo tỉnh/thành của template gốc
   * (ví dụ `/khach-san/ho-chi-minh`) - cùng tập item với danh mục chính.
   */
  isLocationFilter: boolean;
  /** Số URL item thực tế thu thập được từ danh mục này. */
  discoveredCount: number;
  image: MediaRef | null;
  description: string | null;
  seoTitle: string | null;
}

export interface LocationInfo {
  /** Chuỗi địa chỉ gốc, ví dụ "Xã Phước Hải, Thành Phố Hồ Chí Minh". */
  raw: string | null;
  ward: string | null;
  district: string | null;
  city: string | null;
  street: string | null;
}

export interface PriceInfo {
  /** Chuỗi giá gốc, ví dụ "1,000,000" hoặc "17 tỷ". */
  raw: string | null;
  /** Giá quy đổi ra VND (số nguyên), null nếu không parse được. */
  value: number | null;
  currency: 'VND' | null;
  /** Đơn vị gốc: "đ", "tỷ", "tr", "triệu", ... */
  unit: string | null;
  /** Giá trên m² (bất động sản), dạng chuỗi gốc. */
  perM2Raw: string | null;
  perM2Value: number | null;
}

/** Thuộc tính chi tiết của bất động sản (khối `.property-item`). */
export interface PropertyDetails {
  areaText: string | null;
  areaM2: number | null;
  widthM: number | null;
  lengthM: number | null;
  dimensions: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floors: number | null;
  direction: string | null;
  roadWidth: string | null;
  legal: string | null;
  /** Toàn bộ cặp nhãn/giá trị thu được, giữ nguyên tiếng Việt. */
  attributes: Record<string, string>;
}

export interface ContactInfo {
  name: string | null;
  phone: string | null;
  email: string | null;
  zalo: string | null;
  certificate: string | null;
  experience: string | null;
  /** Đã xác thực thông tin hay chưa (icon check trên tiêu đề). */
  verified: boolean | null;
  /** Địa điểm đã có người quản lý hay chưa. */
  hasManager: boolean | null;
}

export interface SeoMeta {
  title: string | null;
  description: string | null;
  keywords: string | null;
  robots: string | null;
  canonical: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  ogType: string | null;
  ogSiteName: string | null;
}

/** Bảng dữ liệu bất kỳ trong nội dung bài viết (giữ nguyên để không mất thông tin). */
export interface TableBlock {
  caption: string | null;
  headers: string[];
  rows: string[][];
}

/** Item đã trích xuất - đơn vị dữ liệu chính để import. */
export interface ScrapedItem {
  /** Khoá ổn định: `<type>:<sourceId>` hoặc `<type>:<slug>` nếu không có ID. */
  id: string;
  type: ItemType;
  sourceId: number | null;
  /** URL tuyệt đối trên site nguồn. */
  url: string;
  canonicalUrl: string | null;
  slug: string;
  /** Tiêu đề hiển thị (H1/H2 trên trang). */
  title: string;
  /** Tiêu đề SEO (`<title>`). */
  seoTitle: string | null;
  /** Mô tả ngắn / sapo. */
  summary: string | null;
  contentHtml: string | null;
  contentText: string | null;
  /** Độ dài nội dung text (ký tự) - hữu ích để lọc bài rỗng. */
  contentLength: number;
  category: CategoryRef | null;
  breadcrumb: string[];
  location: LocationInfo;
  price: PriceInfo | null;
  property: PropertyDetails | null;
  contact: ContactInfo;
  /** Mã tin hiển thị trên trang (nếu có, thường là với tin tức). */
  code: string | null;
  views: number | null;
  tags: string[];
  images: MediaRef[];
  tables: TableBlock[];
  /** Các iframe nhúng (Google Maps, YouTube, ...). */
  embeds: string[];
  /** Liên hệ thu được trong trang (tel:, mailto:, zalo.me). */
  pageContacts: { phones: string[]; emails: string[]; zalo: string[] };
  seo: SeoMeta;
  /** Mọi field đặc thù template mà schema chưa mô hình hoá. */
  extras: Record<string, unknown>;
  crawledAt: string;
  /** SHA-1 của HTML nguồn - dùng để phát hiện thay đổi khi crawl lại. */
  htmlHash: string;
  warnings: string[];
}

/** Metadata của lần crawl. */
export interface DatasetMeta {
  site: string;
  baseUrl: string;
  generatedAt: string;
  tool: { name: string; version: string };
  counts: Record<string, number>;
  options: Record<string, unknown>;
}

export interface Dataset {
  meta: DatasetMeta;
  categories: CategoryRecord[];
  items: ScrapedItem[];
  media: MediaAsset[];
}

/** Trạng thái crawl, dùng để resume. */
export interface RawPageRecord {
  url: string;
  file: string;
  htmlHash: string;
  bytes: number;
  status: number;
  fetchedAt: string;
}

export interface CrawlState {
  version: number;
  startedAt: string;
  updatedAt: string;
  pages: Record<string, RawPageRecord>;
  listings: Record<string, { url: string; file: string; fetchedAt: string; maxPage?: number }>;
  media: Record<string, Omit<MediaAsset, 'usedBy'>>;
}

export interface DiscoveryItemRef {
  url: string;
  section: Section;
  from: string[];
}

export interface DiscoveryListing {
  url: string;
  section: Section;
  title: string | null;
  declaredCount: number | null;
  pagesFetched: number;
  itemUrls: string[];
}

export interface DiscoveryResult {
  generatedAt: string;
  baseUrl: string;
  listings: DiscoveryListing[];
  items: DiscoveryItemRef[];
  skipped: { url: string; reason: string }[];
}
