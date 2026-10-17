/**
 * Bỏ khối "Tags: ..." khỏi nội dung bài viết đã có trong database.
 *
 * Bối cảnh: site cũ chèn danh sách tag vào cuối mỗi bài, trong khi website mới hiển thị
 * tag từ quan hệ `Post.tags` - nếu giữ cả hai thì tag bị trùng.
 *
 * Quan hệ tag trong database KHÔNG bị ảnh hưởng (chỉ xoá phần chữ trong nội dung).
 *
 * Chạy: npm run strip:tags            (xem trước, không ghi)
 *       npm run strip:tags -- --apply (ghi thay đổi)
 */
import { Client } from 'pg';
import { stripTagsBlock, stripTagsText } from '../packages/shared/dist/index.js';

const apply = process.argv.includes('--apply');
const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://phuochai:phuochai@localhost:55432/phuochai';

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const { rows } = await client.query('select id, slug, title, "contentHtml", "contentText" from posts');
  console.log(`Tổng số bài viết: ${rows.length}`);
  console.log(apply ? 'Chế độ: GHI vào database\n' : 'Chế độ: xem trước (thêm --apply để ghi)\n');

  const updates = [];
  let totalRemoved = 0;

  for (const row of rows) {
    const html = row.contentHtml ?? null;
    const text = row.contentText ?? null;
    if (!html && !text) continue;

    const nextHtml = html ? stripTagsBlock(html) : html;
    const nextText = text ? stripTagsText(text) : text;
    if (nextHtml === html && nextText === text) continue;

    totalRemoved += (html?.length ?? 0) - (nextHtml?.length ?? 0);
    updates.push({ id: row.id, slug: row.slug, html: nextHtml, text: nextText, before: row });
  }

  console.log(`Bài cần cập nhật: ${updates.length}`);
  console.log(`Tổng ký tự HTML bị bỏ: ${totalRemoved}`);

  if (updates.length > 0) {
    console.log('\nVí dụ:');
    for (const item of updates.slice(0, 3)) {
      const before = item.before.contentHtml ?? '';
      const after = item.html ?? '';
      console.log(`  • ${item.before.title.slice(0, 46)}`);
      console.log(`      HTML: ${before.length} → ${after.length} ký tự`);
      console.log(`      Text: ${(item.before.contentText ?? '').length} → ${(item.text ?? '').length} ký tự`);
      console.log(`      cuối HTML sau khi bỏ: ...${after.slice(-70).replace(/\n/g, ' ')}`);
    }
  }

  if (apply && updates.length > 0) {
    for (const item of updates) {
      await client.query('update posts set "contentHtml" = $1, "contentText" = $2 where id = $3', [
        item.html,
        item.text,
        item.id,
      ]);
    }
    console.log(`\n✅ Đã cập nhật ${updates.length} bài viết.`);
  } else if (!apply && updates.length > 0) {
    console.log('\n(chưa ghi - chạy lại với --apply để áp dụng)');
  }

  // Kiểm tra lại
  const remainingHtml = await client.query(
    `select count(*) n from posts where "contentHtml" ~* '<strong>\\s*Tags\\s*:'`,
  );
  const remainingText = await client.query(
    `select count(*) n from posts where "contentText" ilike '%Tags:%'`,
  );
  // Bảng quan hệ nhiều-nhiều giữa Post và Tag do Prisma tạo
  const withTags = await client.query(
    'select count(distinct "A") n from "_PostTags"',
  );

  console.log('');
  console.log(`Còn khối Tags trong HTML: ${remainingHtml.rows[0].n}`);
  console.log(`Còn "Tags:" trong text: ${remainingText.rows[0].n}`);
  console.log(`Bài vẫn có quan hệ tag: ${withTags.rows[0].n}`);

  await client.end();
}

main().catch((error) => {
  console.error('Lỗi bỏ khối tags:', error);
  process.exit(1);
});
