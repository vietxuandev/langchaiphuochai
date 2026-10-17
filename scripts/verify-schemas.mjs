/**
 * Test hồi quy cho zod schema dùng chung (FE + BE).
 *
 * Bài học từ lỗi thực tế: frontend parse bằng chính schema này rồi gửi kết quả (`null`) lên
 * backend để parse tiếp. Nếu schema không nhận `null` (hoặc không idempotent) thì mọi mutation
 * có field tuỳ chọn để trống đều thất bại - ví dụ đổi ảnh đại diện không lưu được.
 *
 * Script này kiểm tra:
 *   1. Mọi field tuỳ chọn nhận được `''`, `null` và `undefined`.
 *   2. Schema idempotent: parse(parse(x)) === parse(x).
 *   3. Các ràng buộc quan trọng vẫn được giữ (ảnh phải /upload/, tên tối thiểu 2 ký tự…).
 *
 * Chạy: npm run verify:schemas
 */
import {
  postImageInputSchema,
  postInputSchema,
  updateCategorySchema,
  updateProfileSchema,
} from '../packages/shared/dist/index.js';

let failed = 0;

/** Parse 2 lần để kiểm tra idempotent. */
function check(label, schema, payload, expectation = 'ok') {
  const first = schema.safeParse(payload);

  if (expectation === 'reject') {
    if (first.success) {
      console.log(`❌ ${label}: đáng lẽ phải bị từ chối nhưng lại hợp lệ`);
      failed += 1;
    } else {
      console.log(`✅ ${label}: bị từ chối đúng - ${first.error.issues[0].message}`);
    }
    return;
  }

  if (!first.success) {
    console.log(`❌ ${label}: LỖI VALIDATE - ${first.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    failed += 1;
    return;
  }

  const second = schema.safeParse(first.data);
  const idempotent = second.success && JSON.stringify(second.data) === JSON.stringify(first.data);
  if (!idempotent) {
    console.log(`❌ ${label}: KHÔNG idempotent - parse lần 2 thất bại hoặc khác kết quả`);
    failed += 1;
    return;
  }

  console.log(`✅ ${label}: ${JSON.stringify(first.data).slice(0, 78)}`);
}

console.log('=== 1. Field tuỳ chọn để trống (chuỗi rỗng / null / không gửi) ===');
check('hồ sơ: bio="" phone=null', updateProfileSchema, {
  name: 'Quản trị viên',
  avatarUrl: '/upload/avatars/2026/10/anh.png',
  bio: '',
  phone: null,
});
check('hồ sơ: bio=null, không gửi phone', updateProfileSchema, { name: 'Quản trị viên', bio: null });
check('hồ sơ: xoá ảnh bằng null', updateProfileSchema, { name: 'Quản trị viên', avatarUrl: null });
check('hồ sơ: xoá ảnh bằng chuỗi rỗng', updateProfileSchema, { name: 'Quản trị viên', avatarUrl: '' });
check('danh mục: mọi field tuỳ chọn trống', updateCategorySchema, {
  id: 'cat-1',
  name: 'Homestay',
  slug: '',
  description: null,
  seoTitle: null,
  imagePath: null,
  parentId: null,
});
check('bài viết: summary/seo/category trống', postInputSchema, {
  type: 'NEWS',
  title: 'Bài viết kiểm tra field tuỳ chọn',
  summary: '',
  seoTitle: null,
  seoDescription: null,
  categoryId: null,
  publishedAt: null,
  contentHtml: null,
});
check('ảnh bài viết: alt trống', postImageInputSchema, {
  path: '/upload/posts/2026/10/anh.jpg',
  alt: null,
});

console.log('\n=== 2. Ràng buộc quan trọng vẫn được giữ ===');
check('ảnh đại diện từ domain cũ', updateProfileSchema, { name: 'Quản trị viên', avatarUrl: 'https://phuochai.com/a.jpg' }, 'reject');
check('ảnh bài viết từ nguồn ngoài', postImageInputSchema, { path: 'https://example.com/a.jpg' }, 'reject');
check('tên quá ngắn', updateProfileSchema, { name: 'X' }, 'reject');
check('tiêu đề bài viết quá ngắn', postInputSchema, { type: 'NEWS', title: 'Ngắn' }, 'reject');

console.log('');
if (failed > 0) {
  console.log(`❌ ${failed} kiểm tra thất bại.`);
  process.exit(1);
}
console.log('✅ Schema dùng chung: nhận đủ giá trị rỗng, idempotent và vẫn giữ ràng buộc.');
