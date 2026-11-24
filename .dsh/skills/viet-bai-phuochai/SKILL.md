---
name: viet-bai-phuochai
description: Viết bài du lịch, ẩm thực, lưu trú và lịch trình cho Làng Chài Phước Hải bằng MCP, chuẩn SEO, có mục lục anchor ở đầu bài.
whenToUse: Khi người dùng yêu cầu viết mới, cập nhật, lên lịch trình, chuẩn hoá SEO hoặc tạo bản nháp bài viết cho website Làng Chài Phước Hải.
---

# Viết bài cho Làng Chài Phước Hải

Mục tiêu: tạo bản nháp bài viết tiếng Việt, có dữ liệu thật từ website, cấu trúc SEO rõ ràng, mục lục anchor hoạt động và hình ảnh lấy từ các bài liên quan.

## 1. Trước khi viết

1. Gọi `list_categories` để chọn đúng `categorySlug`.
2. Gọi `search_posts` với từ khoá chính để tránh bài trùng.
3. Gọi `get_post` cho 3-6 bài liên quan để lấy:
   - tên địa điểm/ quán/ homestay thật,
   - slug để link nội bộ,
   - đường dẫn ảnh `/upload/...`.
4. Nếu là bài lịch trình, xác nhận ngày bằng lịch thực tế; không tự coi một ngày là ngày nghỉ chính thức nếu chưa có căn cứ.

Không bịa giá, giờ mở cửa, số liệu hoặc địa chỉ. Nếu dữ liệu không có, viết ở mức tham khảo và nhắc người đọc kiểm tra lại.

## 2. Chọn loại và danh mục

- Trải nghiệm, lịch trình, cẩm nang: `trai-nghiem`
- Ăn uống, quán ăn: `an-uong`
- Điểm tham quan: `diem-tham-quan`
- Lưu trú: `luu-tru` hoặc danh mục con phù hợp
- Thông tin/ chính sách: `thong-tin`

`type` thường là `NEWS`. Với trang tĩnh dùng `PAGE`; MCP vẫn yêu cầu `categorySlug`, thường dùng `thong-tin`.

## 3. Cấu trúc bài chuẩn

Thứ tự bắt buộc:

1. TOC ở **đầu bài**.
2. Intro 2-3 đoạn ngắn, nêu lý do/ lợi ích/ thời điểm.
3. 8-12 mục H2, mỗi H2 có `id="menuN"`.
4. H3 cho ý phụ.
5. Bảng tóm tắt nếu là lịch trình/ so sánh.
6. FAQ 4-6 câu.
7. Kết luận ngắn, có CTA nhẹ.

Không dùng H1 trong nội dung: tiêu đề bài đã là H1.

### TOC bắt buộc

Dùng đúng mẫu trong `references/toc-template.html`. Tóm tắt:

```html
<div id="main-toc">
  <strong>Mục lục</strong>
  <div><a href="#menu1">1. Tên mục 1</a></div>
  <div><a href="#menu2">2. Tên mục 2</a></div>
</div>

<h2 id="menu1">1. Tên mục 1</h2>
```

Quy tắc:

- Mỗi mục TOC phải có đúng một heading `id="menuN"`.
- Số thứ tự trong TOC và H2 phải khớp.
- Dùng `<div>` cho từng mục nếu muốn giữ số `1.`, `2.` trong text.
- Nếu dùng `<ol>` thì **không** viết số trong link text, vì trình duyệt đã tự đánh số; tránh lỗi “1. 1. Giới thiệu chung”.
- Không dùng `name=`; sanitizer MCP hiện chỉ cho `id`.
- Không dựa vào component client để tạo anchor; anchor phải nằm trong HTML lưu vào bài.
- Nếu có “Kết luận” ngoài TOC, vẫn có thể gán `id="menuN"` tiếp theo.

## 4. Viết nội dung

- Tiếng Việt, giọng gần gũi, cụ thể, tránh sáo rỗng.
- Dùng gạch nối `-`, không dùng gạch dài.
- Địa chỉ theo xã/phường: “Xã Phước Hải”, “TP. Hồ Chí Minh”; không dùng quận/huyện cũ.
- Mỗi H2 nên 2-4 đoạn hoặc danh sách ngắn.
- Bài 1.000-1.800 từ là đủ cho hầu hết chủ đề; bài lịch trình có thể dài hơn.
- Chèn 4-8 link nội bộ tới bài liên quan.
- Với bài lịch trình: chia theo ngày/ buổi, có bảng tổng quan, gợi ý lưu trú, ăn uống, chi phí tham khảo và lưu ý.

## 5. Hình ảnh

Lấy từ `get_post` của bài liên quan:

```html
<figure>
  <img src="/upload/news/ten-anh.jpg" alt="Mô tả ảnh cụ thể" />
  <figcaption>Chú thích ngắn</figcaption>
</figure>
```

- Dùng ảnh đúng chủ đề; không dùng lại ảnh không liên quan chỉ để lấp chỗ.
- `alt` phải mô tả nội dung ảnh.
- MCP không set được ảnh hero; sau khi tạo bài, nhắc người dùng thêm hero trong admin.
- Không chèn ảnh ngoài domain nếu chưa có quyền.

## 6. Gọi MCP

Với bài có TOC/ anchor, dùng `contentHtml` (không dùng `contentMarkdown`) để giữ `id` và cấu trúc HTML:

```json
{
  "type": "NEWS",
  "title": "...",
  "slug": "...",
  "summary": "...",
  "categorySlug": "trai-nghiem",
  "ward": "Xã Phước Hải",
  "tags": ["Phước Hải", "..."],
  "idempotencyKey": "ten-bai-2026-11",
  "contentHtml": "<div id=\"main-toc\">...</div><h2 id=\"menu1\">...</h2>"
}
```

Sau khi tạo:

1. `get_post` để kiểm tra.
2. Đếm `<h2 id="menu` và `href="#menu`; hai số phải khớp.
3. Kiểm tra `<img`, link nội bộ, không có `Page not found`.
4. Chỉ publish bằng `set_post_status` khi người dùng yêu cầu.
5. `update_post` chỉ sửa được bài `DRAFT`.

## 7. SEO checklist

Xem chi tiết trong `references/seo-checklist.md`. Tối thiểu:

- Title 50-70 ký tự, có từ khoá chính.
- Summary 140-170 ký tự, tự nhiên.
- Slug ngắn, không dấu, có từ khoá.
- Từ khoá chính xuất hiện ở title, intro, 1-2 H2, kết luận.
- 8-12 H2; không nhồi từ khoá.
- 4-8 internal link; 2-4 external link có nguồn nếu cần.
- FAQ trả lời trực tiếp.
- Ảnh có alt; không ảnh AI/stock sai ngữ cảnh.
- Không cam kết giá/ pháp lý/ an toàn khi chưa có căn cứ.

## 8. Kiểm tra trước khi giao

- TOC nằm trên cùng, trước intro.
- TOC link đúng `#menuN`.
- Heading có `id` tương ứng.
- Link nội bộ đúng slug, đúng loại route:
  - Tin tức: `/tin-tuc/<slug>`
  - Lưu trú: `/luu-tru/<slug>`
  - Bất động sản: `/bat-dong-san/<slug>`
  - Trang tĩnh: `/trang/<slug>`
- Không có H1 trong content.
- Không có dấu gạch dài.
- Không bịa số liệu/ giờ mở cửa.
- Trả về ID, slug, URL admin và trạng thái DRAFT.

## 9. Affiliate Shopee

Khi bài có sản phẩm gợi ý mua kèm:

- Chỉ dùng khi thật sự liên quan; tối đa 1-3 thẻ/bài.
- Gọi `list_affiliate_links` để chọn link đang hoạt động.
- Gọi `validate_affiliate_links` với slug đã chọn trước khi lưu.
- Tạo link trong `/quan-tri/affiliate`, không dán link Shopee trực tiếp.
- Chèn shortcode:

```text
[[affiliate:slug]]
```

- Không sửa shortcode thành link thường.
- Thẻ sản phẩm tự có disclosure, `rel="sponsored nofollow noopener noreferrer"` và link `/go/<slug>`.
- Không bịa giá; `priceText` chỉ là giá tham khảo nếu có dữ liệu.
- Không thêm affiliate vào bài lịch sử, pháp lý hoặc nội dung không liên quan.
- Kiểm tra thẻ hiển thị đúng trên trang công khai sau khi lưu.

## 10. Tài nguyên

- `references/toc-template.html` — mẫu TOC + heading.
- `references/seo-checklist.md` — checklist SEO và nội dung.
- `references/mcp-workflow.md` — lệnh/ quy trình MCP và lỗi thường gặp.
