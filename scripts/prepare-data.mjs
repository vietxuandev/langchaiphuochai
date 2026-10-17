#!/usr/bin/env node
/**
 * Chuẩn bị dữ liệu cho bước seed/import của backend NestJS.
 *
 * Việc script làm:
 *   1. Copy dataset.json, categories.json, media-manifest.json
 *      từ <scraper>/data/export/  ->  <repo>/data/seed/
 *   2. Copy toàn bộ <scraper>/data/export/media/  ->  <repo>/data/upload/
 *
 * Cách dùng (chạy từ thư mục gốc repo):
 *   npm run data:prepare
 *   SCRAPER_EXPORT_DIR=/duong/dan/khac npm run data:prepare
 *   node scripts/prepare-data.mjs --force     # copy lại ảnh dù số file đã khớp
 *
 * Lưu ý: data/upload/ đã nằm trong .gitignore (116MB, không commit).
 */
import { existsSync } from 'node:fs';
import { cp, copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
/** Thư mục gốc repo: <repo>/scripts -> <repo>. */
const repoRoot = path.resolve(scriptDir, '..');
const dataDir = path.join(repoRoot, 'data');
const seedDir = path.join(dataDir, 'seed');
const mediaDest = path.join(dataDir, 'upload');

/** Nguồn mặc định: ../phuochai-scraper/data/export (tính từ thư mục gốc repo). */
const DEFAULT_SOURCE = path.join(repoRoot, '..', 'phuochai-scraper', 'data', 'export');

/** Các file JSON cần copy sang data/seed/. */
const JSON_FILES = ['dataset.json', 'categories.json', 'media-manifest.json'];

const force = process.argv.includes('--force');

/** Đổi số byte sang chuỗi MB dễ đọc. */
function mb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Đường dẫn tương đối từ gốc repo cho log gọn. */
function rel(target) {
  const relative = path.relative(repoRoot, target);
  return relative.startsWith('..') ? target : relative;
}

/** Nguồn dữ liệu: ưu tiên biến môi trường SCRAPER_EXPORT_DIR. */
function resolveSourceDir() {
  const fromEnv = process.env.SCRAPER_EXPORT_DIR?.trim();
  if (fromEnv) return path.resolve(process.cwd(), fromEnv);
  return DEFAULT_SOURCE;
}

/** Liệt kê đệ quy toàn bộ file trong một thư mục. */
async function walk(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(target)));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}

/** Tổng dung lượng của danh sách file (bỏ qua file biến mất giữa chừng). */
async function totalBytes(files) {
  let bytes = 0;
  for (const file of files) {
    try {
      bytes += (await stat(file)).size;
    } catch {
      // file bị xoá trong lúc đang đếm -> bỏ qua
    }
  }
  return bytes;
}

/** Chỉ cho phép xoá đúng thư mục data/upload để tránh tai nạn. */
function assertSafeToRemove(target) {
  const resolved = path.resolve(target);
  if (path.dirname(resolved) !== path.resolve(dataDir) || path.basename(resolved) !== 'upload') {
    throw new Error(`Từ chối xoá đường dẫn không mong đợi: ${resolved}`);
  }
}

async function main() {
  const sourceDir = resolveSourceDir();
  console.log('📦 Chuẩn bị dữ liệu cho phuochai-web');
  console.log(`   Nguồn : ${sourceDir}`);
  console.log(`   Đích  : ${rel(dataDir)}/{seed,upload}\n`);

  if (!existsSync(sourceDir)) {
    throw new Error(
      `Không tìm thấy thư mục nguồn: ${sourceDir}\n` +
        '   👉 Kiểm tra lại project scraper hoặc đặt SCRAPER_EXPORT_DIR=/duong/dan/export',
    );
  }

  // Fail sớm nếu nguồn thiếu dataset.json - seed sẽ không chạy được.
  const datasetSource = path.join(sourceDir, 'dataset.json');
  if (!existsSync(datasetSource)) {
    throw new Error(
      `Nguồn không có dataset.json: ${datasetSource}\n   👉 Kiểm tra lại SCRAPER_EXPORT_DIR.`,
    );
  }

  /* ------------------------- 1. Copy các file JSON ------------------------- */
  await mkdir(seedDir, { recursive: true });
  console.log('1) Copy metadata JSON -> data/seed/');
  let jsonBytes = 0;
  let jsonCount = 0;
  for (const name of JSON_FILES) {
    const from = path.join(sourceDir, name);
    if (!existsSync(from)) {
      console.warn(`   ⚠️  Bỏ qua ${name} (nguồn không có file này)`);
      continue;
    }
    const size = (await stat(from)).size;
    await copyFile(from, path.join(seedDir, name));
    jsonBytes += size;
    jsonCount += 1;
    console.log(`   ✓ ${name} - ${mb(size)}`);
  }
  if (jsonCount === 0) {
    throw new Error(`Không copy được file JSON nào từ ${sourceDir}`);
  }
  if (!existsSync(path.join(seedDir, 'dataset.json'))) {
    throw new Error(`Copy dataset.json thất bại - kiểm tra quyền ghi vào ${seedDir}`);
  }

  /* --------------------------- 2. Copy thư mục media --------------------------- */
  const mediaSrc = path.join(sourceDir, 'media');
  console.log('\n2) Copy ảnh -> data/upload/');
  if (!existsSync(mediaSrc)) {
    throw new Error(`Không tìm thấy thư mục media: ${mediaSrc}`);
  }

  const srcFiles = await walk(mediaSrc);
  const srcBytes = await totalBytes(srcFiles);
  const destFiles = existsSync(mediaDest) ? await walk(mediaDest) : [];

  let mediaCount = destFiles.length;
  let mediaBytes = destFiles.length > 0 ? await totalBytes(destFiles) : 0;

  if (!force && srcFiles.length > 0 && destFiles.length === srcFiles.length) {
    console.log(
      `   ⏭  Bỏ qua: đích đã có ${destFiles.length} file (khớp nguồn ${srcFiles.length} file, ${mb(mediaBytes)}).`,
    );
    console.log('      Dùng --force nếu muốn copy lại từ đầu.');
  } else {
    if (existsSync(mediaDest)) {
      console.log(`   ♻️  Đích đang có ${destFiles.length} file - xoá và copy lại...`);
      assertSafeToRemove(mediaDest);
      await rm(mediaDest, { recursive: true, force: true });
    }
    await mkdir(dataDir, { recursive: true });
    const startedAt = Date.now();
    console.log(`   ⏳ Đang copy ${srcFiles.length} file (${mb(srcBytes)})...`);
    await cp(mediaSrc, mediaDest, { recursive: true, force: true });
    const copied = await walk(mediaDest);
    mediaCount = copied.length;
    mediaBytes = await totalBytes(copied);
    console.log(
      `   ✓ Đã copy ${mediaCount} file (${mb(mediaBytes)}) trong ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
    );
  }

  /* ------------------------------- Tổng kết ------------------------------- */
  console.log('\n──────────────────────────────────────────────');
  console.log(' TỔNG KẾT');
  console.log('──────────────────────────────────────────────');
  console.log(` Metadata JSON : ${jsonCount} file, ${mb(jsonBytes)}  -> ${rel(seedDir)}/`);
  console.log(` Media         : ${mediaCount} file, ${mb(mediaBytes)}  -> ${rel(mediaDest)}/`);
  console.log('──────────────────────────────────────────────');
  console.log('\n👉 Tiếp theo: npm run db:push && npm run db:seed');
}

main().catch((error) => {
  console.error('\n❌ Chuẩn bị dữ liệu thất bại:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
