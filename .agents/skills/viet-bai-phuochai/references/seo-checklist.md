# SEO checklist — bài viết Phước Hải

## Trước khi viết

- [ ] Đã `search_posts` để tránh trùng.
- [ ] Đã chọn đúng `categorySlug`.
- [ ] Đã đọc 3-6 bài liên quan bằng `get_post`.
- [ ] Đã xác nhận địa điểm/ homestay/ quán có thật trong dữ liệu.
- [ ] Đã xác nhận ngày/ thời điểm nếu bài nói về dịp cụ thể.

## Title

- [ ] 50-70 ký tự.
- [ ] Từ khoá chính nằm gần đầu.
- [ ] Không giật tít sai sự thật.
- [ ] Không dùng ALL CAPS toàn bộ.
- [ ] Không nhồi nhiều từ khoá bằng dấu gạch.

Ví dụ tốt:

```text
Kế hoạch 4 ngày nghỉ 24/11 tại Phước Hải: ăn gì, chơi đâu, ở đâu?
```

## Summary

- [ ] 140-170 ký tự.
- [ ] Có lợi ích/ nội dung chính.
- [ ] Không lặp y nguyên title.
- [ ] Không chứa giá/ số liệu chưa kiểm chứng.

## Slug

- [ ] Chữ thường, không dấu, dùng dấu gạch nối.
- [ ] Ngắn, có từ khoá chính.
- [ ] Không chứa ngày nếu bài có thể cập nhật lâu dài; ngày cụ thể chỉ dùng khi bài gắn với dịp đó.

## Cấu trúc

- [ ] TOC ở đầu bài, trước intro.
- [ ] Mỗi mục TOC có `href="#menuN"`.
- [ ] Mỗi heading tương ứng có `id="menuN"`.
- [ ] TOC dạng `<ul><li><a>`, H3 lồng trong H2; không viết số trong chữ link (CSS tự đánh số).
- [ ] Có 8-12 H2.
- [ ] Có H3 cho ý phụ, không lạm dụng.
- [ ] Không có H1 trong content.
- [ ] Có bảng tóm tắt nếu là lịch trình/ so sánh.
- [ ] Có FAQ 4-6 câu.
- [ ] Nếu có affiliate: shortcode `[[affiliate:slug]]` hợp lệ, link đang active, không dán link Shopee trực tiếp.
- [ ] Có disclosure affiliate và thẻ sản phẩm hiển thị đúng.
- [ ] Có kết luận ngắn.

## Nội dung

- [ ] Trả lời đúng ý định tìm kiếm.
- [ ] Có thông tin cụ thể: địa điểm, món, thời điểm, cách di chuyển.
- [ ] Không bịa giờ mở cửa/ giá/ số liệu.
- [ ] Không dùng gạch dài; dùng gạch nối.
- [ ] Địa chỉ theo xã/phường, TP. Hồ Chí Minh.
- [ ] Câu ngắn, đoạn 2-4 câu.
- [ ] Không lặp từ khoá quá 1-2 lần/ đoạn.

## Internal link

- [ ] 4-8 link tới bài liên quan.
- [ ] Đúng route:
  - `/tin-tuc/<slug>`
  - `/luu-tru/<slug>`
  - `/bat-dong-san/<slug>`
  - `/trang/<slug>`
- [ ] Anchor text mô tả đích đến, không dùng “bấm vào đây”.
- [ ] Không link tới bài DRAFT hoặc slug đã xoá.

## Hình ảnh

- [ ] Ảnh đúng chủ đề.
- [ ] `alt` mô tả cụ thể.
- [ ] Có `figcaption` khi cần.
- [ ] Không dùng ảnh ngoài domain nếu chưa có quyền.
- [ ] Đã nhắc người dùng thêm ảnh hero trong admin (MCP không set hero).

## FAQ

- [ ] Câu hỏi là câu người dùng thật sự tìm.
- [ ] Trả lời trực tiếp trong 1-3 câu.
- [ ] Không dùng FAQ để nhồi từ khoá.

## Kiểm tra sau khi tạo

- [ ] `get_post` trả đúng title/ slug/ status.
- [ ] Đếm `<h2 id="menu` = số `href="#menu`.
- [ ] Không có `Page not found`.
- [ ] Ảnh trả về `/upload/...`, không phải URL ngoài.
- [ ] Trạng thái là `DRAFT` trước khi người dùng duyệt.
- [ ] Báo ID, slug, URL admin cho người dùng.

## Dấu hiệu bài yếu

- Title chung chung, không có lợi ích cụ thể.
- Mở bài dài, không trả lời câu hỏi.
- Nhiều H2 nhưng mỗi mục chỉ 1-2 câu.
- Link nội bộ sai slug/ sai loại bài.
- Ảnh không liên quan.
- FAQ hỏi lại title.
- Không có dữ liệu địa phương thật.
