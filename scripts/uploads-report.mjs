/**
 * Báo cáo ảnh trong thư mục `upload/` và phát hiện ảnh rác (không được dùng ở đâu).
 *
 * Ảnh được coi là "đang dùng" nếu xuất hiện ở một trong các nơi:
 *   - users.avatarUrl                (ảnh đại diện người dùng)
 *   - categories.imagePath           (ảnh danh mục)
 *   - post_images.path               (ảnh bài viết)
 *   - posts.contentHtml              (ảnh chèn trong nội dung)
 *
 * Cách dùng:
 *   node scripts/uploads-report.mjs                 # chỉ báo cáo
 *   node scripts/uploads-report.mjs --delete        # xoá ảnh rác
 *   node scripts/uploads-report.mjs --delete --min-age-hours=24   # chỉ xoá ảnh cũ hơn 24h
 */
import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';

const args = process.argv.slice(2);
const shouldDelete = args.includes('--delete');
const minAgeArg = args.find((arg) => arg.startsWith('--min-age-hours='));
const minAgeHours = minAgeArg ? Number(minAgeArg.split('=')[1]) : 0;

const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? 'data/upload');
const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://phuochai:phuochai@localhost:55432/phuochai';

/** Liệt kê đệ quy toàn bộ file trong thư mục upload. */
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const referenced = new Set();
  const add = (value) => {
    if (!value) return;
    const clean = String(value).trim();
    if (clean.startsWith('/upload/')) referenced.add(clean);
  };

  for (const row of (await client.query('select "avatarUrl" from users')).rows) add(row.avatarUrl);
  for (const row of (await client.query('select "imagePath" from categories')).rows) add(row.imagePath);
  for (const row of (await client.query('select path from post_images')).rows) add(row.path);
  for (const row of (await client.query('select "contentHtml" from posts where "contentHtml" like \'%/upload/%\'')).rows) {
    for (const match of String(row.contentHtml).matchAll(/\/upload\/[^"'\s)>]+/g)) add(match[0]);
  }
  await client.end();

  const files = await walk(uploadDir);
  const now = Date.now();
  const orphans = [];
  let usedCount = 0;
  let usedBytes = 0;

  for (const file of files) {
    const stats = await stat(file);
    const publicPath = `/${path.relative(path.dirname(uploadDir), file).split(path.sep).join('/')}`;
    if (referenced.has(publicPath)) {
      usedCount += 1;
      usedBytes += stats.size;
      continue;
    }
    orphans.push({ file, publicPath, size: stats.size, ageHours: (now - stats.mtimeMs) / 36e5 });
  }

  const orphanBytes = orphans.reduce((total, item) => total + item.size, 0);
  const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

  console.log(`Thư mục ảnh : ${uploadDir}`);
  console.log(`Tổng số file: ${files.length} (${mb(usedBytes + orphanBytes)})`);
  console.log(`Đang dùng   : ${usedCount} file (${mb(usedBytes)})`);
  console.log(`Ảnh rác     : ${orphans.length} file (${mb(orphanBytes)})`);

  if (orphans.length > 0) {
    console.log('\nDanh sách ảnh rác (không được tham chiếu ở DB):');
    for (const item of orphans.sort((a, b) => b.size - a.size)) {
      console.log(`  ${mb(item.size).padStart(9)}  ${item.ageHours.toFixed(1)}h  ${item.publicPath}`);
    }
    console.log('\nLưu ý: ảnh vừa upload nhưng chưa bấm "Lưu" cũng nằm trong nhóm này - kiểm tra trước khi xoá.');
  }

  if (shouldDelete) {
    const targets = orphans.filter((item) => item.ageHours >= minAgeHours);
    for (const item of targets) await unlink(item.file);
    console.log(`\nĐã xoá ${targets.length} ảnh rác (cũ hơn ${minAgeHours}h).`);
  }
}

main().catch((error) => {
  console.error('Lỗi khi kiểm tra ảnh:', error);
  process.exit(1);
});
