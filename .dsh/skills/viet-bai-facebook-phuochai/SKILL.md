---
name: viet-bai-facebook-phuochai
description: Viết nội dung bài đăng Facebook hấp dẫn (hook, nhịp điệu, emoji, CTA, hashtag) cho Page Làng Chài Phước Hải từ một bài đã có trên website.
whenToUse: Khi người dùng yêu cầu viết, viết lại, tối ưu hoặc đăng/gỡ bài Facebook cho một bài của Làng Chài Phước Hải. Không dùng để viết bài cho website (dùng viet-bai-phuochai).
---

# Viết bài đăng Facebook cho Làng Chài Phước Hải

Mục tiêu: caption khiến người lướt Facebook dừng lại, đọc hết và bấm vào link bài trên website.

## 1. Lấy dữ liệu thật

1. `search_posts` / `get_post` để lấy bài nguồn (tiêu đề, summary, nội dung, `url`).
2. Chỉ dùng thông tin có trong bài: địa điểm, món, mốc thời gian, mẹo. Không bịa giá, giờ mở cửa, khuyến mãi, số liệu.
3. Chọn 2-4 chi tiết cụ thể, gây tò mò nhất (món gì, thời điểm đẹp nhất, mẹo hữu ích, con số thật) để làm nội dung chính.

## 2. Cấu trúc caption

1. **Dòng tiêu đề**: 1-2 emoji phù hợp chủ đề + tên chủ đề viết HOA + 1 ý lợi ích/ cảm xúc. Tối đa ~80 ký tự.
2. **Hook** (1-2 câu): câu hỏi hoặc tình huống người đọc thấy mình trong đó ("Cuối tuần này đi đâu cho đỡ chán?"). Không mở đầu bằng "Xin chào".
3. **Thân bài** (2-4 dòng ngắn hoặc 3-5 gạch đầu dòng có emoji): nêu chi tiết cụ thể từ bước 1, mỗi dòng một ý, giọng thân thiện, gần gũi như người địa phương kể.
4. **CTA + link**: một câu mời hành động, link bài trên một dòng riêng, ví dụ `👉 Xem lịch trình đầy đủ: <url>`. Link để nguyên URL trần.
5. **Hashtag**: 4-6 tag cuối bài, gồm 1 tag thương hiệu (#PhuocHai hoặc #LangChaiPhuocHai), 1-2 tag địa điểm, 1-2 tag chủ đề.

## 3. Quy tắc định dạng

- Facebook không hiển thị Markdown: **không** dùng `**in đậm**`, `#` tiêu đề, `[text](url)`. Muốn nhấn mạnh thì viết HOA hoặc dùng emoji.
- Mỗi đoạn 1-3 dòng, cách nhau một dòng trống. Tổng độ dài 400-900 ký tự; bài lịch trình dài có thể tới 1.200.
- Emoji vừa đủ (khoảng 5-8 cái), đặt đầu dòng/ cuối câu, đúng ngữ cảnh. Không spam.
- Tiếng Việt có dấu, đúng chính tả. Gọi người đọc là "bạn".
- Không clickbait sai sự thật, không viết quá hoa mỹ, không lặp nguyên văn summary.
- Link luôn là URL bài trên `https://langchaiphuochai.com/...` lấy từ `url` của bài.

## 4. Đầu ra

Trả về:
1. Bản caption chính, trong một khối trích dẫn để dễ copy.
2. 1 phương án thay thế với hook khác (khi người dùng chưa chỉ định).
3. Ghi chú ngắn nếu thiếu dữ liệu cần xác nhận (giá, giờ, ngày).

Không tự đăng khi chưa được người dùng đồng ý với caption. Sau khi đồng ý, chọn theo kịch bản:

- **Đăng một bài cũ đã PUBLISHED**: gọi `post_to_facebook` với `slug` và `caption`. Không đổi trạng thái bài. Nếu báo `ALREADY_POSTED` thì hỏi người dùng có muốn gỡ bài cũ (`unpost_from_facebook`) rồi đăng lại không.
- **Tạo bài mới và đăng ngay**: `create_post` (kèm `facebookCaption`) → `set_post_status` `PUBLISHED`; backend tự đăng đúng caption đó khi `FB_AUTO_POST=true`. Chỉ làm khi người dùng yêu cầu rõ ràng việc đăng.
- **Bài DRAFT**: lưu caption bằng `update_post`/`create_post` (`facebookCaption`), chưa đăng cho đến khi publish.
- **Gỡ khỏi Facebook nhưng giữ bài trên web**: `unpost_from_facebook`.
- **Xoá bài**: `delete_post` tự xoá luôn bài Facebook; thu hồi về DRAFT/ARCHIVED cũng vậy.

Link bài tự được thêm vào caption nếu chưa có. Sau khi gọi tool, kiểm tra kết quả (`facebookPostId`) rồi báo người dùng; nếu `FACEBOOK_ERROR` thì báo nguyên văn lỗi.

## 5. Ví dụ

```
🏕️ CẮM TRẠI SUỐI TIÊN – TRẢI NGHIỆM THIÊN NHIÊN GIỮA NÚI DINH 🌿

Cuối tuần này bạn muốn rời phố thị, nghe tiếng suối và ngủ dưới trời sao?

⛺ Suối Tiên – Núi Dinh là gợi ý đáng thử cho chuyến đi cùng bạn bè, gia đình.
🛒 Mua đồ ăn ở Phước Hải trước khi lên núi cho tiện.
🌤️ Đi buổi sáng để kịp thư thả và an toàn khi về.

👉 Xem lịch trình và kinh nghiệm chi tiết: https://langchaiphuochai.com/tin-tuc/cam-trai-suoi-tien-nui-dinh

#PhuocHai #SuoiTien #NuiDinh #CamTrai #KhamPhaThienNhien
```
