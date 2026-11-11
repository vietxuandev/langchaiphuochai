import { NextResponse, type NextRequest } from 'next/server';

/** Các nhóm route có [slug]; giá trị là loại bài được phép. */
const SECTION_TYPES: Record<string, string[]> = {
  'tin-tuc': ['NEWS'],
  'luu-tru': ['ACCOMMODATION'],
  'bat-dong-san': ['REAL_ESTATE'],
  trang: ['PAGE'],
  'danh-muc': ['CATEGORY'],
};

interface SlugIndex {
  types: Record<string, string[]>;
  categories: string[];
}

let cache: { at: number; data: SlugIndex } | null = null;
const TTL_MS = 60_000;

async function loadIndex(origin: string): Promise<SlugIndex | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;

  try {
    const response = await fetch(new URL('/api/public/slugs', origin), {
      next: { revalidate: 60 },
    });
    if (!response.ok) return null;

    const data = (await response.json()) as SlugIndex;
    if (!data || !data.types || !Array.isArray(data.categories)) return null;
    if (Object.keys(data.types).length === 0) return null;

    cache = { at: Date.now(), data };
    return data;
  } catch {
    return null;
  }
}

function notFoundResponse() {
  const html = `<!doctype html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="robots" content="noindex"><title>404 - Không tìm thấy trang</title></head>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:80px auto;padding:0 20px;line-height:1.6">
<h1>404 - Không tìm thấy trang</h1>
<p>Đường dẫn này không tồn tại hoặc nội dung đã được di chuyển.</p>
<p><a href="/">Về trang chủ</a></p>
</body>
</html>`;

  return new NextResponse(html, {
    status: 404,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}

/**
 * Chặn slug không tồn tại trước khi Next tạo cache ISR 404.
 *
 * Với slug hợp lệ, request đi tiếp vào route ISR bình thường.
 * API lỗi -> fail-open để không làm sập toàn bộ nội dung.
 */
export async function middleware(request: NextRequest) {
  const parts = request.nextUrl.pathname.split('/').filter(Boolean);
  if (parts.length !== 2) return NextResponse.next();

  const [section, rawSlug] = parts;
  const allowedTypes = SECTION_TYPES[section];
  if (!allowedTypes) return NextResponse.next();

  let slug = rawSlug;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    return notFoundResponse();
  }

  // Gọi route slug-index qua localhost để không phụ thuộc Cloudflare/public domain.
  const selfOrigin =
    process.env.WEB_SELF_URL ??
    (process.env.PORT ? `http://localhost:${process.env.PORT}` : request.nextUrl.origin);
  const index = await loadIndex(selfOrigin);
  if (!index) return NextResponse.next();

  const valid =
    allowedTypes[0] === 'CATEGORY'
      ? index.categories.includes(slug)
      : allowedTypes.some((type) => index.types[type]?.includes(slug));

  if (!valid) return notFoundResponse();
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/tin-tuc/:path*',
    '/luu-tru/:path*',
    '/bat-dong-san/:path*',
    '/trang/:path*',
    '/danh-muc/:path*',
  ],
};
