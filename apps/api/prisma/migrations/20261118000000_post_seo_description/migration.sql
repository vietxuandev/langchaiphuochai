-- Mô tả SEO riêng cho bài viết (trước đây form có ô "Mô tả SEO" nhưng giá trị không được lưu).
-- Bài cũ để trống: trang vẫn dùng summary như hiện tại.

ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "seoDescription" TEXT;
