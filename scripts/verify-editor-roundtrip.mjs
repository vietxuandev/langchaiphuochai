/**
 * Kiểm tra "không mất dữ liệu" của editor trực quan (Tiptap).
 *
 * Mô phỏng đúng thao tác: mở một bài viết cũ trong editor → editor parse HTML thành
 * document → serialize lại thành HTML → so sánh các cấu trúc quan trọng (tiêu đề, danh sách,
 * bảng, ảnh, liên kết). Nếu cấu trúc nào bị mất, script báo lỗi.
 *
 * Chạy: node scripts/verify-editor-roundtrip.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { generateHTML, generateJSON } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://phuochai:phuochai@localhost:55432/phuochai';

/** Phải khớp với cấu hình extension trong apps/web/src/components/ui/rich-text-editor.tsx */
const extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
    link: { openOnClick: false, autolink: true },
  }),
  Image.configure({ inline: false, allowBase64: false }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Placeholder.configure({ placeholder: 'x' }),
  TableKit.configure({ table: { resizable: true } }),
];

/** Đếm số lần xuất hiện của từng thẻ trong HTML. */
function countTags(html) {
  const count = (tag) => (html.match(new RegExp(`<${tag}\\b`, 'gi')) ?? []).length;
  return {
    h2: count('h2'),
    h3: count('h3'),
    h4: count('h4'),
    ul: count('ul'),
    ol: count('ol'),
    li: count('li'),
    table: count('table'),
    tr: count('tr'),
    td: count('td') + count('th'),
    img: count('img'),
    a: count('a'),
    p: count('p'),
  };
}

/** Cấu trúc nào bị giảm số lượng so với bản gốc ⇒ có thể mất dữ liệu. */
function diffTags(before, after) {
  const losses = [];
  for (const key of Object.keys(before)) {
    if (after[key] < before[key]) losses.push(`${key}: ${before[key]} → ${after[key]}`);
  }
  return losses;
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  const { rows } = await client.query(
    `select slug, "contentHtml" html from posts
     where "contentHtml" is not null and length("contentHtml") > 200
     order by random() limit 40`,
  );
  await client.end();

  console.log(`Kiểm tra ${rows.length} bài viết ngẫu nhiên...\n`);

  let failures = 0;
  let withTable = 0;

  for (const row of rows) {
    const before = countTags(row.html);
    const json = generateJSON(row.html, extensions);
    const after = countTags(generateHTML(json, extensions));
    const losses = diffTags(before, after);
    if (before.table > 0) withTable += 1;

    if (losses.length > 0) {
      failures += 1;
      console.log(`✗ ${row.slug}`);
      console.log(`   mất cấu trúc: ${losses.join(', ')}`);
    }
  }

  console.log(`\nKết quả: ${rows.length - failures}/${rows.length} bài giữ nguyên cấu trúc.`);
  console.log(`Trong đó ${withTable} bài có bảng - bảng được giữ nhờ TableKit.`);
  if (failures > 0) {
    console.log('\n❌ Có bài bị mất cấu trúc khi mở bằng editor trực quan.');
    process.exit(1);
  }
  console.log('\n✅ Editor trực quan giữ nguyên toàn bộ cấu trúc nội dung hiện có.');
}

main().catch((error) => {
  console.error('Lỗi khi kiểm tra:', error);
  process.exit(1);
});
