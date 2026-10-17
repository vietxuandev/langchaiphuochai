/**
 * Kiểm tra "văn phong" nội dung: không còn dấu gạch dài (em dash U+2014, en dash U+2013).
 *
 * Lý do: gạch dài trong nội dung trông "máy móc"; website dùng gạch nối thường "-".
 *
 * Phạm vi kiểm tra:
 *   1. Database: mọi cột text/json của posts, categories, tags, users, post_images.
 *   2. Mã nguồn: các file .ts/.tsx/.mjs/.graphql/.css/.prisma (bỏ node_modules, dist, .next, generated)
 *      - trừ chính script chuẩn hoá (nơi khai báo ký tự cần thay).
 *
 * Chạy: npm run verify:content   (cần PostgreSQL)
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const EM_DASH = '\u2014';
const EN_DASH = '\u2013';
const DASHES = [EM_DASH, EN_DASH];
const REPLACEMENT = '-';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://phuochai:phuochai@localhost:55432/phuochai';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TABLES = ['posts', 'categories', 'tags', 'users', 'post_images'];
const TEXT_TYPES = ['text', 'character varying'];
const JSON_TYPES = ['json', 'jsonb'];

const SOURCE_DIRS = ['apps/api/src', 'apps/api/prisma', 'apps/web/src', 'packages/shared/src', 'scripts', 'apps/web/scripts'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mjs', '.js', '.graphql', '.css', '.prisma', '.md']);
const IGNORED_FILES = new Set(['normalize-dashes.mjs', 'verify-content.mjs']);

let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) console.log(`✅ ${label}`);
  else {
    console.log(`❌ ${label}${detail ? ` - ${detail}` : ''}`);
    failed += 1;
  }
}

async function checkDatabase() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  console.log('=== 1. Database ===');

  let total = 0;
  const offenders = [];

  for (const table of TABLES) {
    const columns = await client.query(
      `select column_name, data_type from information_schema.columns
       where table_schema = 'public' and table_name = $1 order by ordinal_position`,
      [table],
    );
    for (const { column_name: column, data_type: dataType } of columns.rows) {
      const isJson = JSON_TYPES.includes(dataType);
      if (!isJson && !TEXT_TYPES.includes(dataType)) continue;

      const asText = isJson ? `"${column}"::text` : `"${column}"`;
      const result = await client.query(
        `select count(*) filter (where ${asText} like $1) em,
                count(*) filter (where ${asText} like $2) en
         from ${table}`,
        [`%${EM_DASH}%`, `%${EN_DASH}%`],
      );
      const em = Number(result.rows[0].em);
      const en = Number(result.rows[0].en);
      if (em + en > 0) {
        offenders.push(`${table}.${column} (em: ${em}, en: ${en})`);
        total += em + en;
      }
    }
  }

  assert('Không còn dấu gạch dài trong database', total === 0, offenders.join(', '));

  /* ------------------- Khối "Tags:" trong nội dung bài viết ------------------- */
  console.log('\n=== Khối "Tags:" trong nội dung (không được trùng với mục Thẻ) ===');
  const tagsInHtml = await client.query(
    `select count(*) n from posts where "contentHtml" ~* '<strong[[:space:]]*>[[:space:]]*Tags[[:space:]]*:'`,
  );
  const tagsInText = await client.query(
    `select count(*) n from posts where "contentText" ilike '%Tags:%'`,
  );
  const postsWithTags = await client.query('select count(distinct "A") n from "_PostTags"');

  assert(
    'Không còn khối "Tags:" trong contentHtml',
    Number(tagsInHtml.rows[0].n) === 0,
    `${tagsInHtml.rows[0].n} bài`,
  );
  assert(
    'Không còn "Tags:" trong contentText',
    Number(tagsInText.rows[0].n) === 0,
    `${tagsInText.rows[0].n} bài`,
  );
  assert(
    'Quan hệ tag của bài viết vẫn còn (tag hiển thị từ Post.tags)',
    Number(postsWithTags.rows[0].n) > 0,
    `${postsWithTags.rows[0].n} bài có tag`,
  );

  await client.end();
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.next' || entry.name === 'generated') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

async function checkSource() {
  console.log('\n=== 2. Mã nguồn ===');
  const offenders = [];

  for (const relative of SOURCE_DIRS) {
    for (const file of await walk(path.join(repoRoot, relative))) {
      if (IGNORED_FILES.has(path.basename(file))) continue;
      if (!SOURCE_EXTENSIONS.has(path.extname(file))) continue;
      let content;
      try {
        content = await readFile(file, 'utf8');
      } catch {
        continue;
      }
      const count = DASHES.reduce((sum, dash) => sum + (content.split(dash).length - 1), 0);
      if (count > 0) offenders.push(`${path.relative(repoRoot, file)} (${count})`);
    }
  }

  // README cũng là nội dung người dùng đọc
  const readme = await readFile(path.join(repoRoot, 'README.md'), 'utf8').catch(() => '');
  const readmeCount = DASHES.reduce((sum, dash) => sum + (readme.split(dash).length - 1), 0);
  if (readmeCount > 0) offenders.push(`README.md (${readmeCount})`);

  assert(
    'Không còn dấu gạch dài trong mã nguồn và README',
    offenders.length === 0,
    offenders.slice(0, 5).join(', '),
  );
}

async function main() {
  await checkDatabase();
  await checkSource();

  console.log('');
  if (failed > 0) {
    console.log('Chạy `npm run normalize:dashes -- --apply` để chuẩn hoá database và dataset.');
    process.exit(1);
  }
  console.log(`✅ Nội dung dùng gạch nối thường "${REPLACEMENT}", không còn gạch dài.`);
}

main().catch((error) => {
  console.error('Lỗi kiểm tra nội dung:', error);
  process.exit(1);
});
