-- Bỏ khối "Tags: ..." mà site cũ chèn ở cuối mỗi bài viết.
--
-- Lý do: website mới hiển thị tag từ quan hệ Post.tags (khối "Thẻ" trong trang chi tiết),
-- nên danh sách tag nằm trong nội dung HTML bị trùng lặp.
--
-- Quan hệ tag trong database KHÔNG bị ảnh hưởng - chỉ xoá phần chữ trong nội dung.

-- 1) Nội dung HTML: khối <div ...><strong>Tags: </strong>...các <a>...</div> ở cuối bài
UPDATE "posts" SET "contentHtml" = btrim(
    regexp_replace(
      "contentHtml",
      '<div[^>]*>[[:space:]]*<strong>[[:space:]]*Tags[[:space:]]*:[[:space:]]*</strong>.*',
      '',
      'i'
    ),
    E' \t\n\r'
  )
WHERE "contentHtml" ~* '<strong[[:space:]]*>[[:space:]]*Tags[[:space:]]*:';

-- 2) Văn bản thuần: phần "Tags: tag1 tag2 ..." ở cuối
UPDATE "posts" SET "contentText" = rtrim(left("contentText", position('Tags:' in "contentText") - 1))
WHERE "contentText" ilike '%Tags:%'
  AND position('Tags:' in "contentText") > length("contentText") - 1000
  -- chỉ cắt khi phần sau "Tags:" giống danh sách tag (không có dấu kết câu ở giữa)
  AND regexp_replace(
        substring("contentText" from position('Tags:' in "contentText")),
        '^Tags:[[:space:]]*',
        '',
        'i'
      ) !~ '[.!?][[:space:]]';
