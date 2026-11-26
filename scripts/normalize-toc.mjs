/**
 * Chuẩn hoá mục lục (TOC) của mọi bài viết trong database về một định dạng duy nhất.
 *
 * Định dạng chuẩn: <div id="main-toc"><strong>Mục lục</strong><ul><li><a href="#menuN">…</a></li></ul></div>
 * (xem packages/shared/src/toc.ts). Số thứ tự do CSS tự đánh.
 *
 * Áp dụng cho: bài đang có mục lục (kiểu cũ hoặc mới) và bài NEWS có từ 2 H2 trở lên.
 * Không đụng tới nội dung ngoài mục lục, trừ việc bổ sung `id` cho H2/H3 còn thiếu.
 *
 * Chạy: npm run normalize:toc            (xem trước, không ghi)
 *       npm run normalize:toc -- --apply (ghi thay đổi)
 */
import { Client } from 'pg';
import { normalizeToc } from '../packages/shared/dist/index.js';

const apply = process.argv.includes('--apply');
const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://phuochai:phuochai@localhost:55432/phuochai';

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const { rows } = await client.query(
    `select id, slug, type, title, "contentHtml" from posts
     where "contentHtml" is not null and ("contentHtml" ~* 'id=.main-toc.' or type = 'NEWS')`,
  );
  console.log(`Bài được xét: ${rows.length}`);
  console.log(apply ? 'Chế độ: GHI vào database\n' : 'Chế độ: xem trước (thêm --apply để ghi)\n');

  const updates = [];
  for (const row of rows) {
    const result = normalizeToc(row.contentHtml);
    if (result.changed) updates.push({ ...row, html: result.html, sections: result.sections });
  }

  const withToc = updates.filter((item) => item.sections > 0).length;
  console.log(`Bài cần cập nhật: ${updates.length} (có mục lục sau chuẩn hoá: ${withToc})`);
  for (const item of updates.slice(0, 5)) {
    console.log(`  • [${item.type}] ${item.slug} - ${item.sections} mục`);
  }

  if (apply && updates.length > 0) {
    await client.query('begin');
    try {
      for (const item of updates) {
        await client.query('update posts set "contentHtml" = $1 where id = $2', [item.html, item.id]);
      }
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    }
    console.log(`\n✅ Đã cập nhật ${updates.length} bài viết.`);
  } else if (updates.length > 0) {
    console.log('\n(chưa ghi - chạy lại với --apply để áp dụng)');
  }

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
