/**
 * Làm sạch HTML của các bài viết đã lưu bằng đúng bộ lọc API đang dùng khi ghi (chống XSS).
 *
 * Mặc định chỉ **báo cáo** (dry-run): liệt kê bài có thẻ/thuộc tính sẽ bị loại
 * (script, on*, javascript:, iframe, style lạ...). Thêm `--apply` để ghi nội dung đã lọc.
 *
 *   npx tsx apps/api/scripts/sanitize-post-html.ts           # chạy ở thư mục gốc repo,
 *   npx tsx apps/api/scripts/sanitize-post-html.ts --apply   # hoặc ở /app trong container api
 *
 * Bài không bị loại gì thì giữ nguyên (không ghi DB, không đổi updatedAt).
 * Sau khi `--apply`, trang công khai tự làm mới trong vòng ~5 phút (ISR).
 */
import { PrismaClient } from '@prisma/client';
import { load } from 'cheerio';
import sanitizeHtml from 'sanitize-html';
import { htmlToText, sanitizePostHtml } from '../src/common/post-html';

const prisma = new PrismaClient();
const BATCH_SIZE = 100;

/** Đếm tag, tag@thuộc-tính, class và thuộc tính style - để biết bộ lọc đã bỏ những gì. */
function inventory(html: string): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
  const $ = load(html, null, false);

  for (const node of $('*').toArray()) {
    if (!('tagName' in node)) continue;
    const tag = node.tagName.toLowerCase();
    add(tag);
    for (const [name, value] of Object.entries(node.attribs)) {
      if (name === 'style') {
        for (const declaration of value.split(';')) {
          const property = declaration.split(':')[0]?.trim().toLowerCase();
          if (property) add(`${tag}@style:${property}`);
        }
      } else if (name === 'class') {
        for (const token of value.split(/\s+/).filter(Boolean)) add(`${tag}.${token}`);
      } else if (name === 'href' || name === 'src') {
        // Ghi lại scheme để phát hiện href/src bị xoá vì là javascript:, data:...
        const scheme = /^\s*([a-z][a-z0-9+.-]*):/i.exec(value)?.[1]?.toLowerCase() ?? 'relative';
        add(`${tag}@${name}:${scheme}`);
      } else {
        add(`${tag}@${name}`);
      }
    }
  }
  return counts;
}

/** Serialize lại HTML nhưng KHÔNG lọc gì - để so sánh công bằng với bản đã lọc. */
function passthrough(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: false,
    allowedAttributes: false,
    allowVulnerableTags: true,
    // Giữ cả href/src kiểu javascript: để bước so sánh phát hiện được chúng
    allowedSchemesAppliedToAttributes: [],
  });
}

/** Những thứ có trong bản gốc nhưng mất ở bản đã lọc, dạng `img@onerror×1`. */
function removedItems(html: string, cleaned: string): string[] {
  const before = inventory(passthrough(html));
  const after = inventory(cleaned);
  const removed: string[] = [];
  for (const [key, count] of before) {
    const lost = count - (after.get(key) ?? 0);
    if (lost > 0) removed.push(`${key}×${lost}`);
  }
  return removed;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  console.log(`\n🧽 Làm sạch HTML bài viết${apply ? '' : ' (dry-run, thêm --apply để ghi thật)'}\n`);

  let cursor: string | undefined;
  let scanned = 0;
  let flagged = 0;
  let updated = 0;

  for (;;) {
    const rows = await prisma.post.findMany({
      where: { contentHtml: { not: null } },
      select: { id: true, slug: true, status: true, contentHtml: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned += 1;
      const html = row.contentHtml ?? '';
      const cleaned = sanitizePostHtml(html);
      const removed = removedItems(html, cleaned);
      if (removed.length === 0) continue;

      flagged += 1;
      const preview = removed.slice(0, 8).join(', ') + (removed.length > 8 ? ', ...' : '');
      console.log(`   - [${row.status}] ${row.slug} (id ${row.id}): bỏ ${preview}`);

      if (apply) {
        await prisma.post.update({
          where: { id: row.id },
          data: { contentHtml: cleaned, contentText: htmlToText(cleaned) },
        });
        updated += 1;
      }
    }

    cursor = rows[rows.length - 1]?.id;
  }

  console.log(`\nĐã quét ${scanned} bài, ${flagged} bài có nội dung bị lọc.`);
  if (apply) console.log(`Đã ghi lại ${updated} bài.`);
  else if (flagged > 0) console.log('Chạy lại với --apply để ghi nội dung đã lọc.');
}

main()
  .catch((error) => {
    console.error('Lỗi:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
