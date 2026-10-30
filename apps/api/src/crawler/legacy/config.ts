/**
 * Cấu hình tối thiểu cho phần đọc dữ liệu từ website cũ (phuochai.com).
 *
 * Chỉ port những gì cần cho việc đọc bài viết: địa chỉ site + cấu hình HTTP.
 * (Bản gốc trong `phuochai-scraper` còn cấu hình đường dẫn output/CLI - không cần ở đây.)
 */
export const site = {
  id: 'phuochai',
  name: 'Phuochai.com',
  /** Đổi bằng biến môi trường LEGACY_SITE_URL nếu site cũ chuyển địa chỉ. */
  baseUrl: (process.env.LEGACY_SITE_URL ?? 'https://phuochai.com').replace(/\/+$/, ''),
  /** Trang "index" để quét danh sách bài mới khi bật chế độ quét listing. */
  seeds: ['/noi-luu-tru', '/tin-tuc.html', '/bat-dong-san.html'],
  /** Chỉ đi theo các link nằm trong các prefix này khi quét listing. */
  listingPrefixes: ['/noi-luu-tru', '/tin-tuc', '/bat-dong-san', '/danh-cho-du-khach', '/ve-chung-toi'],
  /** Không bao giờ crawl các đường dẫn này. */
  denyPrefixes: ['/dang-nhap', '/dang-ky', '/lay-lai-mat-khau', '/tags', '/tim-kiem', '/countview'],
  pageParam: 'page',
} as const;

export const http = {
  timeoutMs: Number(process.env.LEGACY_HTTP_TIMEOUT_MS ?? 25_000),
  retries: 2,
  retryBaseDelayMs: 700,
  /** Số request song song tối đa khi quét nhiều URL. */
  concurrency: 4,
  minDelayMs: 200,
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36 phuochai-web-crawler/1.0 (+admin import)',
} as const;
