/**
 * Kiểm tra tính idempotent (chạy lại KHÔNG sinh dữ liệu trùng) của `prisma/seed.ts`.
 *
 * Vì sao cần: đã gặp lỗi seed tạo thêm danh mục "Homestay" trùng ở mỗi lần chạy
 * (homestay-2 → homestay-3 → homestay-4 → homestay-5), kéo theo bài viết bị gán sang bản mới.
 *
 * Cách kiểm tra:
 *   1. Ghi nhận số lượng bản ghi trước khi chạy seed.
 *   2. Chạy `prisma/seed.ts` (đúng lệnh `npm run db:seed`).
 *   3. So sánh: số lượng phải y hệt, và không được có 2 danh mục cùng (tên + nhóm).
 *
 * Chạy: npm run verify:seed   (cần PostgreSQL; mất khoảng 1 phút)
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(here, '..', 'apps', 'api');
const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://phuochai:phuochai@localhost:55432/phuochai';

async function snapshot(client) {
  const one = async (sql) => Number((await client.query(sql)).rows[0].n);
  const duplicates = await client.query(
    'select name, section, count(*) n from categories group by name, section having count(*) > 1',
  );

  return {
    posts: await one('select count(*) n from posts'),
    categories: await one('select count(*) n from categories'),
    tags: await one('select count(*) n from tags'),
    postImages: await one('select count(*) n from post_images'),
    users: await one('select count(*) n from users'),
    postsWithoutCategory: await one('select count(*) n from posts where "categoryId" is null'),
    duplicateCategories: duplicates.rows,
  };
}

function printSnapshot(label, snapshot) {
  console.log(`${label}`);
  console.log(`   bài viết: ${snapshot.posts} | danh mục: ${snapshot.categories} | tag: ${snapshot.tags}`);
  console.log(`   ảnh: ${snapshot.postImages} | người dùng: ${snapshot.users} | bài không có danh mục: ${snapshot.postsWithoutCategory}`);
  console.log(
    `   danh mục trùng (tên + nhóm): ${snapshot.duplicateCategories.length === 0 ? 'không' : JSON.stringify(snapshot.duplicateCategories)}`,
  );
}

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const before = await snapshot(client);
  printSnapshot('Trước khi chạy seed:', before);

  console.log('\nĐang chạy lại seed (giống `npm run db:seed`)...');
  const seed = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', 'prisma/seed.ts'], {
    cwd: apiDir,
    stdio: 'inherit',
    env: process.env,
  });
  if (seed.status !== 0) {
    console.log(`\n❌ Seed chạy thất bại (exit ${seed.status}).`);
    process.exit(1);
  }

  const after = await snapshot(client);
  await client.end();
  console.log('');
  printSnapshot('Sau khi chạy lại seed:', after);

  const failures = [];
  for (const key of ['posts', 'categories', 'tags', 'postImages', 'users', 'postsWithoutCategory']) {
    if (before[key] !== after[key]) {
      failures.push(`${key}: ${before[key]} → ${after[key]}`);
    }
  }
  if (after.duplicateCategories.length > 0) {
    failures.push(`có danh mục trùng (tên + nhóm): ${JSON.stringify(after.duplicateCategories)}`);
  }

  console.log('');
  if (failures.length > 0) {
    failures.forEach((failure) => console.log(`❌ ${failure}`));
    console.log('\n❌ Seed KHÔNG idempotent - chạy lại đã làm thay đổi dữ liệu.');
    process.exit(1);
  }
  console.log('✅ Seed idempotent: chạy lại không sinh dữ liệu trùng, số lượng bản ghi không đổi.');
}

main().catch((error) => {
  console.error('Lỗi khi kiểm tra seed:', error);
  process.exit(1);
});
