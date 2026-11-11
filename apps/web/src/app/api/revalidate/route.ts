import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * On-demand revalidation sau khi API publish/sửa/xoá bài.
 *
 * Gọi từ API qua mạng nội bộ Docker, kèm header x-revalidate-secret.
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const provided =
    request.headers.get('x-revalidate-secret') ??
    new URL(request.url).searchParams.get('secret');

  if (!secret || provided !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let paths: string[] = [];
  try {
    const body = (await request.json()) as { paths?: unknown };
    if (Array.isArray(body.paths)) {
      paths = body.paths
        .filter((path): path is string => typeof path === 'string')
        .filter((path) => path.startsWith('/'))
        .slice(0, 50);
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  for (const path of paths) {
    revalidatePath(path);
  }
  // Xoá cache dữ liệu RSC (unstable_cache) để lần render sau lấy dữ liệu mới.
  revalidateTag('graphql');

  return NextResponse.json({ ok: true, paths });
}
