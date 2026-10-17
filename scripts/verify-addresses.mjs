/**
 * Kiểm tra dữ liệu địa chỉ theo danh mục hành chính TP. Hồ Chí Minh.
 *
 * Bối cảnh: Việt Nam đã bỏ cấp quận/huyện, website chỉ hỗ trợ TP. Hồ Chí Minh (168 xã/phường).
 * Script này kiểm tra cả **dữ liệu trong database** và **helper dùng chung**:
 *   1. Không còn cột `district`.
 *   2. Mọi `ward` phải nằm trong danh mục 168 xã/phường (hoặc null).
 *   3. Mọi `city` phải là "Thành phố Hồ Chí Minh".
 *   4. `addressRaw` không còn chứa phần xã/phường/tỉnh-thành ở cuối.
 *   5. Helper: tìm xã/phường chấp nhận thiếu dấu/thiếu tiền tố, từ chối quận cũ, tách địa chỉ đúng.
 *
 * Chạy: npm run verify:addresses
 */
import { Client } from 'pg';
import {
  PROVINCE_NAME,
  WARDS,
  canonicalWardName,
  formatAddress,
  searchWards,
  stripAdministrativeParts,
} from '../packages/shared/dist/index.js';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://phuochai:phuochai@localhost:55432/phuochai';
const wardNames = new Set(WARDS.map((ward) => ward.name));

let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`✅ ${label}`);
  } else {
    console.log(`❌ ${label}${detail ? ` - ${detail}` : ''}`);
    failed += 1;
  }
}

async function checkDatabase() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  console.log('=== 1. Cấu trúc database ===');
  const columns = await client.query(
    "select column_name from information_schema.columns where table_name = 'posts'",
  );
  const columnNames = new Set(columns.rows.map((row) => row.column_name));
  assert('Không còn cột district (đã bỏ cấp quận/huyện)', !columnNames.has('district'));
  assert('Có cột ward (xã/phường)', columnNames.has('ward'));
  assert('Có cột city (tỉnh/thành)', columnNames.has('city'));

  console.log('\n=== 2. Dữ liệu xã/phường ===');
  const wards = await client.query(
    'select ward, count(*) n from posts group by ward order by n desc',
  );
  const invalidWards = wards.rows.filter((row) => row.ward !== null && !wardNames.has(row.ward));
  assert(
    'Mọi xã/phường đều nằm trong danh mục 168 đơn vị',
    invalidWards.length === 0,
    invalidWards.map((row) => row.ward).join(', '),
  );

  console.log('   Phân bố:');
  for (const row of wards.rows) {
    console.log(`     ${String(row.ward ?? '(chưa có)').padEnd(24)} ${row.n}`);
  }

  console.log('\n=== 3. Tỉnh/thành phố ===');
  const cities = await client.query('select city, count(*) n from posts where city is not null group by city');
  const wrongCities = cities.rows.filter((row) => row.city !== PROVINCE_NAME);
  assert(
    `Mọi bài có city = "${PROVINCE_NAME}"`,
    wrongCities.length === 0,
    wrongCities.map((row) => row.city).join(', '),
  );

  console.log('\n=== 4. Địa chỉ chi tiết (addressRaw) ===');
  const dirty = await client.query(
    `select title, "addressRaw" from posts
     where "addressRaw" is not null
       and (
         "addressRaw" ilike '%thành phố hồ chí minh%'
         or "addressRaw" ilike '%tp. hồ chí minh%'
         or "addressRaw" ilike '%việt nam%'
         or "addressRaw" ~* '(^|,)\\s*(xã|phường)\\s'
       )`,
  );
  assert(
    'addressRaw không còn phần xã/phường/tỉnh-thành',
    dirty.rows.length === 0,
    dirty.rows
      .slice(0, 3)
      .map((row) => `"${row.addressRaw}"`)
      .join(' | '),
  );

  await client.end();
}

function checkHelpers() {
  console.log('\n=== 5. Helper dùng chung ===');
  assert(`${WARDS.length} xã/phường trong danh mục`, WARDS.length === 168, `nhận ${WARDS.length}`);
  assert('Có đặc khu Côn Đảo', WARDS.some((ward) => ward.name === 'Đặc khu Côn Đảo'));

  assert('Tìm được "Xã Phước Hải"', canonicalWardName('Xã Phước Hải') === 'Xã Phước Hải');
  assert('Tìm được khi thiếu tiền tố ("Phước Hải")', canonicalWardName('Phước Hải') === 'Xã Phước Hải');
  assert('Tìm được khi không dấu ("phuoc hai")', canonicalWardName('phuoc hai') === 'Xã Phước Hải');
  assert(
    'Tìm được khi có hậu tố lạ ("Xã Phước Hải (Xem bản đồ)")',
    canonicalWardName('Xã Phước Hải (Xem bản đồ)') === 'Xã Phước Hải',
  );
  assert('Từ chối quận cũ ("Quận 1")', canonicalWardName('Quận 1') === null);
  assert('Từ chối huyện cũ ("Huyện Long Điền")', canonicalWardName('Huyện Long Điền') === null);

  const search = searchWards('phuoc', 10).map((ward) => ward.name);
  assert('Tìm kiếm "phuoc" trả về xã/phường liên quan', search.includes('Xã Phước Hải'), search.join(', '));
  assert('Tìm kiếm ưu tiên khớp đầu tên', searchWards('vung', 5)[0]?.name === 'Phường Vũng Tàu');

  const strip1 = stripAdministrativeParts('khu phố Hải Sơn, Xã Phước Hải, Thành Phố Hồ Chí Minh', {
    ward: 'Xã Phước Hải',
  });
  assert('Tách địa chỉ: bỏ xã/phường + tỉnh/thành', strip1 === 'khu phố Hải Sơn', `"${strip1}"`);

  const strip2 = stripAdministrativeParts('1093 Đ. Võ Thị Sáu, Long Hải, Hồ Chí Minh 78412, Việt Nam', {
    ward: 'Xã Phước Hải',
  });
  assert('Tách địa chỉ: bỏ cả quốc gia + mã bưu điện', strip2 === '1093 Đ. Võ Thị Sáu', `"${strip2}"`);

  const strip3 = stripAdministrativeParts('Bãi Biển Phước Hải, lô 44A', { ward: 'Xã Phước Hải' });
  assert('Giữ nguyên địa danh không nằm ở cuối', strip3 === 'Bãi Biển Phước Hải, lô 44A', `"${strip3}"`);

  const formatted = formatAddress({
    addressRaw: 'khu phố Hải Sơn',
    ward: 'Xã Phước Hải',
    city: PROVINCE_NAME,
  });
  assert(
    'Ghép địa chỉ hiển thị đúng',
    formatted === 'khu phố Hải Sơn, Xã Phước Hải, Thành phố Hồ Chí Minh',
    formatted,
  );
}

async function main() {
  await checkDatabase();
  checkHelpers();

  console.log('');
  if (failed > 0) {
    console.log(`❌ ${failed} kiểm tra thất bại.`);
    process.exit(1);
  }
  console.log('✅ Địa chỉ đã theo đúng danh mục 168 xã/phường TP. Hồ Chí Minh, không còn quận/huyện.');
}

main().catch((error) => {
  console.error('Lỗi kiểm tra địa chỉ:', error);
  process.exit(1);
});
