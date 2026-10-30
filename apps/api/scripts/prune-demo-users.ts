/**
 * Xoá các tài khoản demo do seed cũ tạo ra (editor@ / user@ ...).
 *
 * Mặc định chỉ **liệt kê** (dry-run). Thêm `--apply` để xoá thật.
 *
 *   npm run db:prune-demo              # xem sẽ xoá gì
 *   npm run db:prune-demo -- --apply   # xoá
 *
 * Quy tắc an toàn:
 *  - Không xoá tài khoản ADMIN (tránh mất quyền quản trị).
 *  - Không xoá tài khoản đã có bài viết (trừ khi thêm `--force`).
 *  - Danh sách email có thể đổi qua biến môi trường DEMO_EMAILS (phân tách bằng dấu phẩy).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_DEMO_EMAILS = ['editor@langchaiphuochai.com', 'user@langchaiphuochai.com'];

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const force = process.argv.includes('--force');
  const emails = (process.env.DEMO_EMAILS?.split(',') ?? DEFAULT_DEMO_EMAILS)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  console.log(`\n🧹 Xoá tài khoản demo${apply ? '' : ' (dry-run, thêm --apply để xoá thật)'}`);
  console.log(`   Ứng viên: ${emails.join(', ')}\n`);

  let removed = 0;
  let skipped = 0;

  for (const email of emails) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, _count: { select: { posts: true } } },
    });

    if (!user) {
      console.log(`   - ${email}: không tồn tại, bỏ qua`);
      continue;
    }
    if (user.role === 'ADMIN') {
      console.log(`   ! ${email}: là ADMIN, KHÔNG xoá`);
      skipped += 1;
      continue;
    }
    if (user._count.posts > 0 && !force) {
      console.log(`   ! ${email}: đã có ${user._count.posts} bài viết, KHÔNG xoá (thêm --force nếu chắc chắn)`);
      skipped += 1;
      continue;
    }

    if (apply) {
      await prisma.user.delete({ where: { id: user.id } });
      console.log(`   ✗ ${email}: đã xoá`);
      removed += 1;
    } else {
      console.log(`   ? ${email}: sẽ xoá (${user.role}, ${user._count.posts} bài viết)`);
    }
  }

  console.log(`\n   Kết quả: ${apply ? `đã xoá ${removed}` : 'chưa xoá gì'} | bỏ qua ${skipped}`);
  if (!apply) console.log('   Chạy lại với --apply để thực hiện.\n');
}

main()
  .catch((error) => {
    console.error('Lỗi khi xoá tài khoản demo:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
