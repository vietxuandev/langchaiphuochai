/**
 * Chuẩn hoá dấu gạch ngang trong toàn bộ nội dung: em dash (U+2014) và en dash (U+2013) -> "-" (U+002D).
 *
 * Lý do: nội dung dùng gạch dài trông "máy móc"; website dùng gạch nối thường.
 *
 * Phạm vi:
 *   1. Database: các cột văn bản của posts, categories, tags, users.
 *   2. Dataset nguồn (`data/seed/*.json`) để lần import sau không sinh lại dấu cũ.
 *
 * Chạy: npm run normalize:dashes            (xem trước, không ghi)
 *       npm run normalize:dashes -- --apply (ghi thay đổi)
 *
 * Các ký tự được viết bằng escape (\u2014, \u2013) để chính script này không bị thay thế khi chạy.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';

const apply = process.argv.includes('--apply');
const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://phuochai:phuochai@localhost:55432/phuochai';

const EM_DASH = '\u2014';
const EN_DASH = '\u2013';
const DASHES = [EM_DASH, EN_DASH];
const REPLACEMENT = '-';

/** Điều kiện SQL: cột có chứa một trong các dấu gạch dài. */
function hasDashSql(quoted) {
  return `(${quoted} like '%${EM_DASH}%' or ${quoted} like '%${EN_DASH}%')`;
}

/** Biểu thức SQL: thay từng loại gạch dài bằng "-". */
function buildReplaceSql(quoted) {
  return `replace(replace(${quoted}, '${EM_DASH}', '${REPLACEMENT}'), '${EN_DASH}', '${REPLACEMENT}')`;
}

/**
 * Bảng dữ liệu cần chuẩn hoá. Cột được lấy tự động theo kiểu dữ liệu
 * (text, varchar, json, jsonb) nên không bỏ sót cột mới thêm sau này.
 */
const TABLES = ['posts', 'categories', 'tags', 'users', 'post_images'];
const TEXT_TYPES = ['text', 'character varying'];
const JSON_TYPES = ['json', 'jsonb'];

/** Lấy danh sách cột văn bản/JSON của một bảng. */
async function listColumns(client, table) {
  const result = await client.query(
    `select column_name, data_type from information_schema.columns
     where table_schema = 'public' and table_name = $1
     order by ordinal_position`,
    [table],
  );
  return result.rows;
}

async function normalizeDatabase() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  console.log('=== 1. Database ===');
  let totalRows = 0;

  for (const table of TABLES) {
    const columns = await listColumns(client, table);
    for (const { column_name: column, data_type: dataType } of columns) {
      const quoted = `"${column}"`;
      const isJson = JSON_TYPES.includes(dataType);
      if (!isJson && !TEXT_TYPES.includes(dataType)) continue;

      const asText = isJson ? `${quoted}::text` : quoted;
      const before = await client.query(`select count(*) n from ${table} where ${hasDashSql(asText)}`);
      const affected = Number(before.rows[0].n);
      if (affected === 0) continue;

      const perDash = await client.query(
        `select
           count(*) filter (where ${asText} like '%${EM_DASH}%') as em,
           count(*) filter (where ${asText} like '%${EN_DASH}%') as en
         from ${table}`,
      );
      console.log(
        `  ${table}.${column}${isJson ? ` (${dataType})` : ''}: ${affected} bản ghi ` +
          `(em dash: ${perDash.rows[0].em}, en dash: ${perDash.rows[0].en})`,
      );
      totalRows += affected;

      if (apply) {
        const replacement = buildReplaceSql(asText);
        const assignment = isJson ? `${replacement}::${dataType}` : replacement;
        await client.query(
          `update ${table} set ${quoted} = ${assignment} where ${hasDashSql(asText)}`,
        );
      }
    }
  }

  if (totalRows === 0) {
    console.log('  (không còn dấu gạch dài nào cần đổi)');
  } else {
    console.log(`  → Tổng ${totalRows} bản ghi${apply ? ' đã cập nhật' : ' cần cập nhật'}`);
  }

  if (apply) {
    let remaining = 0;
    for (const table of TABLES) {
      for (const { column_name: column, data_type: dataType } of await listColumns(client, table)) {
        const isJson = JSON_TYPES.includes(dataType);
        if (!isJson && !TEXT_TYPES.includes(dataType)) continue;
        const asText = isJson ? `"${column}"::text` : `"${column}"`;
        const r = await client.query(`select count(*) n from ${table} where ${hasDashSql(asText)}`);
        remaining += Number(r.rows[0].n);
      }
    }
    console.log(`  Kiểm tra lại: ${remaining} bản ghi còn dấu gạch dài ${remaining === 0 ? '✓' : '✗'}`);
  }

  await client.end();
  return totalRows;
}

async function normalizeDataset() {
  console.log('\n=== 2. Dataset nguồn (data/seed) ===');
  const files = ['data/seed/dataset.json', 'data/seed/categories.json'];
  let totalOccurrences = 0;

  for (const relative of files) {
    const absolute = path.resolve(relative);
    let content;
    try {
      content = await readFile(absolute, 'utf8');
    } catch {
      console.log(`  ${relative}: không có file, bỏ qua`);
      continue;
    }

    let occurrences = 0;
    for (const dash of DASHES) occurrences += content.split(dash).length - 1;

    if (occurrences === 0) {
      console.log(`  ${relative}: không có dấu gạch dài`);
      continue;
    }

    console.log(`  ${relative}: ${occurrences} dấu gạch dài`);
    totalOccurrences += occurrences;

    if (apply) {
      let updated = content;
      for (const dash of DASHES) updated = updated.split(dash).join(REPLACEMENT);
      await writeFile(absolute, updated, 'utf8');
    }
  }

  if (totalOccurrences > 0 && !apply) {
    console.log('  (chưa ghi - chạy lại với --apply để áp dụng)');
  }
  return totalOccurrences;
}

async function main() {
  console.log(apply ? 'Chế độ: GHI thay đổi\n' : 'Chế độ: xem trước (thêm --apply để ghi)\n');
  const dbCount = await normalizeDatabase();
  const fileCount = await normalizeDataset();

  console.log('');
  if (apply) {
    console.log('✅ Đã chuẩn hoá dấu gạch dài thành "-".');
  } else if (dbCount > 0 || fileCount > 0) {
    console.log('Chạy `npm run normalize:dashes -- --apply` để áp dụng.');
  } else {
    console.log('✅ Không còn dấu gạch dài nào.');
  }
}

main().catch((error) => {
  console.error('Lỗi chuẩn hoá dấu gạch:', error);
  process.exit(1);
});
