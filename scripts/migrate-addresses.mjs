/**
 * Migration địa chỉ: chuẩn hoá dữ liệu cũ theo danh mục hành chính TP. Hồ Chí Minh.
 *
 * Việt Nam đã bỏ cấp quận/huyện (01/07/2025) và website chỉ hỗ trợ TP. Hồ Chí Minh, nên:
 *   1. `ward`  : đưa về tên chuẩn trong 168 xã/phường/đặc khu (chấp nhận thiếu dấu, thiếu tiền tố).
 *   2. `city`  : luôn là "Thành phố Hồ Chí Minh".
 *   3. `addressRaw`: chỉ giữ địa chỉ chi tiết (bỏ "Xã Phước Hải, Thành Phố Hồ Chí Minh" ở cuối).
 *
 * Chạy: npm run migrate:addresses                          (xem trước, không ghi)
 *       npm run migrate:addresses -- --apply               (ghi vào database)
 *       npm run migrate:addresses -- --apply --default-ward="Xã Phước Hải"
 *                                                          (gán cho các bài chưa có xã/phường)
 *
 * Lưu ý: `npm run db:seed` cũng chuẩn hoá địa chỉ khi import nên với dữ liệu crawl chỉ cần chạy lại seed.
 * Script này dùng cho dữ liệu do người dùng nhập tay hoặc khi không muốn import lại.
 */
import { Client } from 'pg';
import { PROVINCE_NAME, canonicalWardName, stripAdministrativeParts } from '../packages/shared/dist/index.js';

const apply = process.argv.includes('--apply');
/** Ví dụ: --default-ward="Xã Phước Hải" - gán cho các bài chưa có xã/phường. */
const defaultWardArg = process.argv.find((arg) => arg.startsWith('--default-ward='));
const defaultWard = defaultWardArg ? canonicalWardName(defaultWardArg.split('=')[1].replace(/^"|"$/g, '')) : null;
if (defaultWardArg && !defaultWard) {
  console.error('--default-ward không khớp xã/phường nào trong danh mục TP. Hồ Chí Minh');
  process.exit(1);
}
const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://phuochai:phuochai@localhost:55432/phuochai';

async function main() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const { rows } = await client.query('select id, title, "addressRaw", ward, city from posts');
  console.log(`Tổng số bài viết: ${rows.length}`);
  console.log(apply ? 'Chế độ: GHI vào database\n' : 'Chế độ: xem trước (thêm --apply để ghi)\n');

  const updates = [];
  const unmapped = [];

  for (const row of rows) {
    const ward =
      canonicalWardName(row.ward) ?? canonicalWardName(row.addressRaw) ?? defaultWard ?? null;
    const city = PROVINCE_NAME;
    const addressRaw = stripAdministrativeParts(row.addressRaw, { ward }) || null;

    const changed =
      ward !== (row.ward ?? null) || city !== (row.city ?? null) || addressRaw !== (row.addressRaw ?? null);

    if (ward === null && row.ward !== null) unmapped.push(row);
    if (changed) updates.push({ id: row.id, addressRaw, ward, city, before: row });
  }

  console.log(`Cần cập nhật: ${updates.length} bài`);
  console.log(`Xã/phường không khớp danh mục: ${unmapped.length} bài`);

  if (updates.length > 0) {
    console.log('\nVí dụ thay đổi:');
    for (const item of updates.slice(0, 5)) {
      console.log(`  • ${item.before.title.slice(0, 44)}`);
      console.log(`      ward: ${JSON.stringify(item.before.ward)} → ${JSON.stringify(item.ward)}`);
      console.log(`      city: ${JSON.stringify(item.before.city)} → ${JSON.stringify(item.city)}`);
      console.log(`      địa chỉ: ${JSON.stringify(item.before.addressRaw)} → ${JSON.stringify(item.addressRaw)}`);
    }
  }

  if (unmapped.length > 0) {
    console.log('\nCác bài có xã/phường không khớp (cần nhập tay):');
    for (const row of unmapped.slice(0, 10)) {
      console.log(`  - ${row.title.slice(0, 50)} | ward cũ: ${JSON.stringify(row.ward)}`);
    }
  }

  if (apply && updates.length > 0) {
    for (const item of updates) {
      await client.query('update posts set "addressRaw" = $1, ward = $2, city = $3 where id = $4', [
        item.addressRaw,
        item.ward,
        item.city,
        item.id,
      ]);
    }
    console.log(`\n✅ Đã cập nhật ${updates.length} bài viết.`);
  } else if (!apply && updates.length > 0) {
    console.log('\n(chưa ghi gì - chạy lại với --apply để áp dụng)');
  }

  const summary = await client.query(
    'select coalesce(ward, $$(chưa có)$$) as ward, count(*) n from posts group by ward order by n desc',
  );
  console.log('\nPhân bố theo xã/phường:');
  for (const row of summary.rows) console.log(`  ${String(row.ward).padEnd(24)} ${row.n}`);

  const cities = await client.query('select coalesce(city, $$(chưa có)$$) as city, count(*) n from posts group by city');
  console.log('\nPhân bố theo tỉnh/thành:');
  for (const row of cities.rows) console.log(`  ${String(row.city).padEnd(30)} ${row.n}`);

  await client.end();
}

main().catch((error) => {
  console.error('Lỗi migration địa chỉ:', error);
  process.exit(1);
});
