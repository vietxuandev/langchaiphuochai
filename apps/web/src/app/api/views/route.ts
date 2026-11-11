import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const WINDOW_MS = 60_000;
const hits = new Map<string, number>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
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

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(`${ip}:${slug}`)) {
    return new NextResponse(null, { status: 204 });
  }

  const apiUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

  try {
    await fetch(`${apiUrl}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'query TrackPostView($slug: String!) { post(slug: $slug, countView: true) { id views } }',
        variables: { slug },
      }),
      cache: 'no-store',
    });
  } catch {
    // Không làm lỗi trang nếu API tạm thời không phản hồi.
  }

  return new NextResponse(null, { status: 204 });
}
