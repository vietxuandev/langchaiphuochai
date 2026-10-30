/**
 * Kiểm tra các file BẮT BUỘC phải có trong repo trước khi push/deploy.
 *
 * Vì sao cần: đã gặp lỗi build trên Coolify (exit code 2) chỉ vì `.gitignore` ghi `data/`
 * (không có dấu `/` đầu) -> git bỏ qua MỌI thư mục tên `data`, kể cả
 * `packages/shared/src/data/hcm-wards.json` (dữ liệu 168 xã/phường). File không được push
 * nên `npm run build:shared` trên server thất bại.
 *
 * Script này kiểm tra 2 lớp:
 *   1. File có tồn tại trên đĩa.
 *   2. Nếu đang ở trong git repo: file có được git theo dõi (`git ls-files`) hay không.
 *
 * Chạy: npm run verify:repo
 */
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** File cần có để build/chạy được (đặc biệt khi deploy từ git). */
const REQUIRED_FILES = [
  'package.json',
  'package-lock.json',
  'packages/shared/package.json',
  'packages/shared/src/data/hcm-wards.json',
  'packages/shared/src/address.ts',
  'apps/api/package.json',
  'apps/api/prisma/schema.prisma',
  'apps/api/prisma/seed.ts',
  'apps/api/schema.graphql',
  'apps/api/Dockerfile',
  'apps/web/package.json',
  'apps/web/Dockerfile',
  'apps/web/codegen.ts',
  'apps/web/next.config.mjs',
  // Icon & manifest của website (Next tự chèn link từ các file này)
  'apps/web/src/app/favicon.ico',
  'apps/web/src/app/icon.png',
  'apps/web/src/app/apple-icon.png',
  'apps/web/src/app/manifest.ts',
  // SEO: robots.txt + sitemap.xml (sinh từ code)
  'apps/web/src/app/robots.ts',
  'apps/web/src/app/sitemap.ts',
  // Logo dùng chung trong UI (import trong brand-logo.tsx)
  'apps/web/public/icons/logo-mark.png',
  'apps/web/src/components/site/brand-logo.tsx',
  'apps/web/public/icons/android-chrome-192x192.png',
  'apps/web/public/icons/android-chrome-512x512.png',
  // File xác minh chủ sở hữu với Google Search Console (phải phục vụ tại /google*.html)
  'apps/web/public/googledb548b8b95ead655.html',
  'docker-compose.coolify.yml',
  '.dockerignore',
];

const REQUIRED_DIRS = ['apps/api/prisma/migrations'];

let failed = 0;
let gitAvailable = false;

try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: root, stdio: 'ignore' });
  gitAvailable = true;
} catch {
  gitAvailable = false;
}

console.log(`Thư mục: ${root}`);
console.log(`Git repo: ${gitAvailable ? 'có' : 'không (chỉ kiểm tra file tồn tại)'}\n`);

const tracked = gitAvailable
  ? new Set(
      execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    )
  : null;

console.log('=== File bắt buộc ===');
for (const relative of REQUIRED_FILES) {
  const exists = existsSync(path.join(root, relative));
  const inGit = tracked ? tracked.has(relative) : null;

  if (!exists) {
    console.log(`❌ THIẾU trên đĩa: ${relative}`);
    failed += 1;
  } else if (inGit === false) {
    console.log(`❌ CÓ trên đĩa nhưng KHÔNG được git theo dõi: ${relative}`);
    console.log(`   -> kiểm tra .gitignore (dùng "/data/" chứ không phải "data/") rồi: git add -f ${relative}`);
    failed += 1;
  } else {
    console.log(`✅ ${relative}${inGit ? ' (đã có trong git)' : ''}`);
  }
}

console.log('\n=== Thư mục bắt buộc ===');
for (const relative of REQUIRED_DIRS) {
  const exists = existsSync(path.join(root, relative));
  if (!exists) {
    console.log(`❌ THIẾU: ${relative}/`);
    failed += 1;
    continue;
  }
  const hasFiles = tracked
    ? [...tracked].some((file) => file.startsWith(`${relative}/`))
    : true;
  if (tracked && !hasFiles) {
    console.log(`❌ ${relative}/ không có file nào trong git`);
    failed += 1;
  } else {
    console.log(`✅ ${relative}/${tracked ? ' (có file trong git)' : ''}`);
  }
}

console.log('');
if (failed > 0) {
  console.log(`❌ ${failed} mục thiếu - sửa .gitignore + git add rồi push lại trước khi deploy.`);
  process.exit(1);
}
console.log('✅ Repo có đủ file cần cho build trên server.');
