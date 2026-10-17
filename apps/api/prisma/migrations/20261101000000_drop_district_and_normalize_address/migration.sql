-- Việt Nam đã bỏ cấp quận/huyện (từ 01/07/2025) và website chỉ hỗ trợ TP. Hồ Chí Minh.
--
-- 1) Chuẩn hoá tỉnh/thành về đúng tên đơn vị hành chính: "Thành phố Hồ Chí Minh"
--    (dữ liệu cũ có thể là "Thành Phố Hồ Chí Minh", "... (Xem bản đồ)").
UPDATE "posts" SET "city" = 'Thành phố Hồ Chí Minh' WHERE "city" IS NOT NULL;

-- 2) Bỏ cột quận/huyện.
ALTER TABLE "posts" DROP COLUMN IF EXISTS "district";

-- 3) Thêm index cho lọc theo xã/phường.
CREATE INDEX IF NOT EXISTS "posts_ward_idx" ON "posts"("ward");

-- Ghi chú: tên xã/phường được chuẩn hoá theo danh mục 168 xã/phường của TP. Hồ Chí Minh
-- bằng `npm run migrate:addresses` (hoặc import lại dữ liệu: `npm run db:seed`).
