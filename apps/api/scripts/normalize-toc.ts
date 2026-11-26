/**
 * Chuẩn hoá mục lục (TOC) của mọi bài viết về một định dạng duy nhất (xem packages/shared/src/toc.ts).
 * Áp dụng cho bài đang có mục lục và bài NEWS. Mặc định chỉ xem trước; thêm `--apply` để ghi.
 *
 *   node apps/api/dist/scripts/normalize-toc.js [--apply]   # trong container api
 *   npx tsx apps/api/scripts/normalize-toc.ts [--apply]     # ở local
 */
import { PrismaClient } from '@prisma/client';
import { normalizeToc } from '@phuochai/shared';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

async function main() {
  const posts = await prisma.post.findMany({
    where: { OR: [{ contentHtml: { contains: 'main-toc' } }, { type: 'NEWS' }] },
    select: { id: true, slug: true, type: true, contentHtml: true },
  });
  const updates = posts.flatMap((post) => {
    if (!post.contentHtml) return [];
    const result = normalizeToc(post.contentHtml);
    return result.changed ? [{ ...post, html: result.html, sections: result.sections }] : [];
  });

  console.log(`Bài được xét: ${posts.length} | cần cập nhật: ${updates.length}`);
  for (const item of updates.slice(0, 5)) console.log(`  • [${item.type}] ${item.slug} - ${item.sections} mục`);

  if (!apply) {
    if (updates.length) console.log('\n(chưa ghi - chạy lại với --apply để áp dụng)');
    return;
  }
  await prisma.$transaction(
    updates.map((item) => prisma.post.update({ where: { id: item.id }, data: { contentHtml: item.html } })),
  );
  console.log(`\n✅ Đã cập nhật ${updates.length} bài viết.`);
}

main().finally(() => prisma.$disconnect());
