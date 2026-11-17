import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WINDOW_MS = 60_000;
/** Mỗi IP chỉ được tính 1 lượt xem / bài / phút. */
const hits = new Map<string, number>();
/** Trần lượt xem mỗi bài mỗi phút (kể cả khi đổi IP liên tục). */
const MAX_VIEWS_PER_SLUG_PER_WINDOW = 60;
const slugWindows = new Map<string, { start: number; count: number }>();

function isRateLimited(key: string, now: number): boolean {
  const last = hits.get(key);
  if (last && now - last < WINDOW_MS) return true;
  hits.set(key, now);

  // Dọn map định kỳ để không tăng vô hạn.
  if (hits.size > 5000) {
    for (const [item, at] of hits) {
      if (now - at > WINDOW_MS) hits.delete(item);
    }
  }
  return false;
}

function isSlugOverCap(slug: string, now: number): boolean {
  const window = slugWindows.get(slug);
  if (!window || now - window.start >= WINDOW_MS) {
    slugWindows.set(slug, { start: now, count: 1 });
    if (slugWindows.size > 5000) {
      for (const [item, value] of slugWindows) {
        if (now - value.start >= WINDOW_MS) slugWindows.delete(item);
      }
    }
    return false;
  }
  window.count += 1;
  return window.count > MAX_VIEWS_PER_SLUG_PER_WINDOW;
}

/** IP người xem: Cloudflare → Traefik (X-Real-IP) → X-Forwarded-For (giống cách API lấy IP). */
function clientIp(request: Request): string {
  const first = (value: string | null) => value?.split(',')[0]?.trim().slice(0, 64) || undefined;
  return (
    first(request.headers.get('cf-connecting-ip')) ??
    first(request.headers.get('x-real-ip')) ??
    first(request.headers.get('x-forwarded-for')) ??
    'unknown'
  );
}

/** Tăng lượt xem sau khi trang đã render (không chặn HTML/SEO). */
export async function POST(request: Request) {
  let slug = '';
  try {
    const body = (await request.json()) as { slug?: unknown };
    slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!slug || slug.length > 300) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const now = Date.now();
  if (isRateLimited(`${clientIp(request)}:${slug}`, now) || isSlugOverCap(slug, now)) {
    return new NextResponse(null, { status: 204 });
  }

  const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
  const secret = process.env.REVALIDATE_SECRET;

  try {
    await fetch(`${apiUrl}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // API chỉ tính lượt xem khi có secret nội bộ (chặn gọi thẳng GraphQL để bơm lượt xem)
        ...(secret ? { 'x-internal-secret': secret } : {}),
      },
      body: JSON.stringify({
        query: 'query TrackPostView($slug: String!) { post(slug: $slug, countView: true) { id } }',
        variables: { slug },
      }),
      cache: 'no-store',
    });
  } catch {
    // Không làm lỗi trang nếu API tạm thời không phản hồi.
  }

  return new NextResponse(null, { status: 204 });
}
