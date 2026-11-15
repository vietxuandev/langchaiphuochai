# MCP workflow — tạo bài Phước Hải

## Tool có sẵn

| Tool | Dùng khi |
|---|---|
| `whoami` | Kiểm tra token, scope, giới hạn |
| `list_categories` | Chọn `categorySlug` |
| `list_wards` | Chọn đúng xã/phường |
| `search_posts` | Kiểm tra bài trùng, tìm bài liên quan |
| `get_post` | Lấy nội dung, slug, ảnh, thông tin địa điểm |
| `create_post` | Tạo bản nháp |
| `update_post` | Sửa bài đang DRAFT |
| `set_post_status` | Publish / thu hồi / archive |
| `delete_post` | Xoá vĩnh viễn, chỉ ADMIN, cần confirmSlug |

## Quy trình

```text
whoami
→ list_categories
→ list_wards (nếu bài có địa chỉ)
→ search_posts (từ khoá chính)
→ get_post (3-6 bài liên quan)
→ tạo contentHtml có TOC id
→ create_post
→ get_post kiểm tra
→ báo DRAFT cho người dùng
→ chỉ publish khi được yêu cầu
```

## Payload mẫu

```json
{
  "type": "NEWS",
  "title": "Kế hoạch 4 ngày nghỉ 24/11 tại Phước Hải: ăn gì, chơi đâu, ở đâu?",
  "slug": "ke-hoach-4-ngay-nghi-24-11-tai-phuoc-hai",
  "summary": "Lên kế hoạch cho 4 ngày nghỉ 21-24/11/2026 tại Phước Hải: lịch trình từng ngày, bãi tắm, quảng trường, chợ Lộc An, hải sản và gợi ý homestay, resort.",
  "categorySlug": "trai-nghiem",
  "ward": "Xã Phước Hải",
  "tags": ["Phước Hải", "24/11", "lịch trình 4 ngày"],
  "idempotencyKey": "ke-hoach-4-ngay-nghi-24-11-phuoc-hai-2026",
  "contentHtml": "<div id=\"main-toc\"><strong>Mục lục</strong><ol><li><a href=\"#menu1\">Vì sao chọn Phước Hải?</a></li></ol></div><h2 id=\"menu1\">1. Vì sao chọn Phước Hải?</h2><p>...</p>"
}
```

`contentHtml` phải là HTML đã sạch. Không gửi `<script>`, `<iframe>`, sự kiện inline.

## TOC và id

- Sanitizer MCP đã cho phép `id` trên heading/div/a.
- Dùng `id="menu1"`, `menu2`... và `href="#menu1"`.
- Không dùng `name=`.
- Nếu dùng `contentMarkdown`, heading Markdown không có `id`; vì vậy bài có TOC phải dùng `contentHtml`.
- Kiểm tra sau khi lưu:
  - số `<h2 id="menu...">` phải bằng số `href="#menu..."`.
  - TOC phải nằm trước intro.

## Ảnh

`get_post` trả:

```json
{
  "images": [
    { "path": "/upload/news/abc-1.jpg", "role": "hero" },
    { "path": "/upload/news/abc-2.jpg", "role": "content" }
  ]
}
```

Chèn vào contentHtml:

```html
<figure>
  <img src="/upload/news/abc-2.jpg" alt="Mô tả ảnh" />
  <figcaption>Chú thích ngắn.</figcaption>
</figure>
```

MCP không set được ảnh hero; phải thêm trong admin sau.

## Trạng thái

- `create_post` luôn tạo `DRAFT`.
- `update_post` chỉ sửa bài `DRAFT`.
- `set_post_status` cần scope `posts:publish`; dùng `ARCHIVED` nếu muốn ẩn an toàn.
- `delete_post` chỉ ADMIN, cần `confirmSlug` đúng.

## Lỗi thường gặp

| Lỗi | Cách xử lý |
|---|---|
| `INVALID_CATEGORY` | Gọi `list_categories` lấy slug đúng |
| `INVALID_WARD` | Gọi `list_wards` |
| `POST_NOT_DRAFT` | Dùng `set_post_status` đưa về DRAFT trước, hoặc tạo bản mới |
| `CONFIRM_MISMATCH` | Truyền đúng slug hiện tại |
| TOC link không nhảy | Thiếu `id` trên heading hoặc id không khớp `href` |
| Ảnh không hiển thị | Đường dẫn phải bắt đầu `/upload/...` |
| Bài mới không thấy ngay | ISR/slug index có thể trễ khoảng 60 giây; kiểm tra sau |

## Kiểm tra nhanh sau khi tạo

```text
get_post { slug }
```

Kiểm tra:

- `status` = `DRAFT`
- `contentHtml` có `<div id="main-toc">`
- Có `href="#menu1"` và `<h2 id="menu1">`
- Có `<img src="/upload/...">`
- Link nội bộ đúng loại route

Sau đó báo:

```text
ID: ...
Slug: ...
Admin: /quan-tri/bai-viet/<id>
Trạng thái: DRAFT
```
