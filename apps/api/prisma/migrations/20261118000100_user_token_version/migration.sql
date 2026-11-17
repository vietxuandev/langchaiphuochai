-- Phiên bản token của tài khoản: đổi mật khẩu thì tăng lên, JWT mang phiên bản cũ hết hiệu lực.
-- Token đang dùng (chưa có phiên bản) được coi là phiên bản 0 nên không ai bị đăng xuất khi deploy.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
