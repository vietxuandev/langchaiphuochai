-- Luồng duyệt tài khoản: người đăng ký mới ở trạng thái PENDING, quản trị viên duyệt -> ACTIVE.
-- Tài khoản đang có giữ nguyên ACTIVE (mặc định) để không ảnh hưởng người dùng hiện tại.

DO $$
BEGIN
  CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "reviewNote" TEXT;

CREATE INDEX IF NOT EXISTS "users_status_idx" ON "users"("status");
