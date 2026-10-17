-- Chuẩn hoá dấu gạch dài trong nội dung: em dash (U+2014) và en dash (U+2013) -> "-" (U+002D).
-- Nội dung dùng gạch dài trông "máy móc"; website dùng gạch nối thường.

UPDATE "posts" SET
  "title" = replace(replace("title", U&'\2014', '-'), U&'\2013', '-'),
  "summary" = replace(replace("summary", U&'\2014', '-'), U&'\2013', '-'),
  "seoTitle" = replace(replace("seoTitle", U&'\2014', '-'), U&'\2013', '-'),
  "addressRaw" = replace(replace("addressRaw", U&'\2014', '-'), U&'\2013', '-')
WHERE "title" ~ U&'[\2014\2013]'
   OR "summary" ~ U&'[\2014\2013]'
   OR "seoTitle" ~ U&'[\2014\2013]'
   OR "addressRaw" ~ U&'[\2014\2013]';

UPDATE "posts" SET
  "contentHtml" = replace(replace("contentHtml", U&'\2014', '-'), U&'\2013', '-'),
  "contentText" = replace(replace("contentText", U&'\2014', '-'), U&'\2013', '-')
WHERE "contentHtml" ~ U&'[\2014\2013]'
   OR "contentText" ~ U&'[\2014\2013]';

UPDATE "categories" SET
  "name" = replace(replace("name", U&'\2014', '-'), U&'\2013', '-'),
  "description" = replace(replace("description", U&'\2014', '-'), U&'\2013', '-'),
  "seoTitle" = replace(replace("seoTitle", U&'\2014', '-'), U&'\2013', '-')
WHERE "name" ~ U&'[\2014\2013]'
   OR "description" ~ U&'[\2014\2013]'
   OR "seoTitle" ~ U&'[\2014\2013]';

UPDATE "tags" SET "name" = replace(replace("name", U&'\2014', '-'), U&'\2013', '-')
WHERE "name" ~ U&'[\2014\2013]';

UPDATE "users" SET
  "name" = replace(replace("name", U&'\2014', '-'), U&'\2013', '-'),
  "bio" = replace(replace("bio", U&'\2014', '-'), U&'\2013', '-')
WHERE "name" ~ U&'[\2014\2013]' OR "bio" ~ U&'[\2014\2013]';

-- Cột JSON (SEO) và chú thích ảnh
UPDATE "posts" SET "seo" = replace(replace("seo"::text, U&'\2014', '-'), U&'\2013', '-')::jsonb
WHERE "seo"::text ~ U&'[\2014\2013]';

UPDATE "post_images" SET "alt" = replace(replace("alt", U&'\2014', '-'), U&'\2013', '-')
WHERE "alt" ~ U&'[\2014\2013]';
