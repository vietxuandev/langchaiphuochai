# Affiliate Shopee

## Quản trị

- Trang quản lý: `/quan-tri/affiliate`
- Quyền: `EDITOR` trở lên.
- API:
  - `GET /api/affiliate` — danh sách, tìm kiếm, lọc trạng thái
  - `GET /api/affiliate/stats` — click, top link, health
  - `POST /api/affiliate` — tạo link
  - `PATCH /api/affiliate/:id` — sửa link
  - `DELETE /api/affiliate/:id` — xoá link (kèm log click)
  - `GET /api/affiliate/public/:slug` — dữ liệu thẻ sản phẩm (public)
  - `GET /go/:slug` — redirect 302 tới Shopee, ghi click

## Cách dùng trong bài viết

1. Tạo link trong admin, lấy slug.
2. Trong editor, bấm nút **Chèn thẻ sản phẩm affiliate** và chọn link.
3. Editor chèn shortcode:

```text
[[affiliate:slug]]
```

4. Khi render, shortcode được thay bằng thẻ sản phẩm; bài tự hiện disclosure.
5. Link CTA dùng `/go/<slug>?from=<post-slug>` với:

```html
rel="sponsored nofollow noopener noreferrer"
```

Không dán trực tiếp link Shopee vào bài.

## Dữ liệu

- `affiliate_links`: link, slug, ảnh, giá tham khảo, campaign, sub_id, trạng thái, clicks.
- `affiliate_clicks`: log click, `postSlug`, referrer, `ipHash`, userAgent.
- Không lưu IP thô.

Migration: `apps/api/prisma/migrations/20261124000000_affiliate_links`.
Khi deploy, API chạy `prisma migrate deploy` trước khi start.

## Bảo mật / SEO

- URL đích chỉ nhận `shopee.vn` / `shope.ee`.
- `/go/:slug` trả `302`, `Cache-Control: no-store`, `X-Robots-Tag: noindex`.
- `robots.txt` chặn `/go/`.
- Admin API yêu cầu JWT + role `EDITOR`.
- `AFFILIATE_HASH_SALT` (tuỳ chọn) dùng để hash IP; mặc định fallback `JWT_SECRET`.

## Kiểm tra sau deploy

```bash
curl -sI https://langchaiphuochai.com/go/<slug>
curl -s  https://langchaiphuochai.com/api/affiliate/public/<slug>
```

Kỳ vọng `/go/<slug>` trả `302` và `location` là Shopee kèm `sub_id`.
