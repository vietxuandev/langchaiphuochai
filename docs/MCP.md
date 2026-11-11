# MCP server cho AI agent

> Phase 1 + quản lý bài: personal access token + 9 tool (đọc, tạo, sửa nháp, đổi trạng thái, xoá). Xem kế hoạch tổng thể ở [MCP_PLAN.md](./MCP_PLAN.md).

## 1. Tổng quan

- Endpoint: `POST https://mcp.langchaiphuochai.com/mcp` (Streamable HTTP, stateless, trả JSON).
- Xác thực: `Authorization: Bearer phca_<id>_<secret>` (token tạo trong trang quản trị).
- Agent mặc định **tạo/sửa bản nháp (DRAFT)**. Có thể publish/unpublish/archive nếu token có scope `posts:publish`; xoá chỉ ADMIN và cần xác nhận slug.
- Mỗi lần gọi tool đều được ghi vào bảng `mcp_audit_logs` (token, tool, kết quả, thời gian, postId).

## 2. Tạo token

1. Đăng nhập quản trị -> menu **Token AI agent** (`/quan-tri/agent-tokens`).
2. Bấm **Tạo token**: đặt tên (ví dụ "Claude Code - laptop"), chọn quyền, chọn hạn.
3. Copy token ngay (chỉ hiển thị một lần) và dán vào cấu hình client.
4. Muốn khoá ngay: bấm biểu tượng thùng rác để **thu hồi** (agent nhận 401 ngay lập tức).

Quyền:

| Scope | Ý nghĩa |
|---|---|
| `posts:read` | Đọc bài, danh mục, xã/phường, tìm kiếm |
| `posts:write` | Tạo/sửa bản nháp |
| `posts:publish` | Xuất bản/thu hồi (Phase 2) |
| `media:write` | Tải ảnh lên (Phase 2) |

Mặc định token mới có `posts:read`, `posts:write`, `media:write` (không có quyền xuất bản).

## 3. Cấu hình client

### Claude Code

`.mcp.json` ở thư mục dự án (hoặc `~/.claude.json`):

```json
{
  "mcpServers": {
    "phuochai": {
      "type": "http",
      "url": "https://mcp.langchaiphuochai.com/mcp",
      "headers": { "Authorization": "Bearer phca_xxx_yyy" }
    }
  }
}
```

### Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "phuochai": {
      "url": "https://mcp.langchaiphuochai.com/mcp",
      "headers": { "Authorization": "Bearer phca_xxx_yyy" }
    }
  }
}
```

### VS Code (Copilot Chat)

`.vscode/mcp.json`:

```json
{
  "servers": {
    "phuochai": {
      "type": "http",
      "url": "https://mcp.langchaiphuochai.com/mcp",
      "headers": { "Authorization": "Bearer phca_xxx_yyy" }
    }
  }
}
```

### n8n / script

HTTP Request node hoặc `curl`:

```bash
curl -sS https://mcp.langchaiphuochai.com/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer phca_xxx_yyy" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "create_post",
      "arguments": {
        "type": "NEWS",
        "title": "Ăn gì ở Phước Hải buổi sáng?",
        "categorySlug": "an-uong",
        "contentMarkdown": "## Món ăn sáng\n\n...",
        "ward": "Xã Phước Hải",
        "idempotencyKey": "an-sang-phuoc-hai-2026-11"
      }
    }
  }'
```

Mọi request phải có `Accept: application/json, text/event-stream` (yêu cầu của MCP Streamable HTTP).

## 4. Tool

### `whoami`

Không cần tham số. Trả user, scope, giới hạn, quy trình viết bài.

### `list_categories`

| Tham số | Kiểu | Ghi chú |
|---|---|---|
| `section` | `ACCOMMODATION` \| `NEWS` \| `REAL_ESTATE` \| `PAGE` | Không bắt buộc |

Trả `[{ slug, name, section, level, isLocationFilter, postCount }]`.

### `list_wards`

| Tham số | Kiểu | Ghi chú |
|---|---|---|
| `query` | string (≤ 60) | Tìm không dấu cũng được |

Trả tối đa 30 xã/phường `[{ name, code }]`.

### `search_posts`

| Tham số | Kiểu | Ghi chú |
|---|---|---|
| `keyword` | string (≤ 200) | Tìm trong tiêu đề, slug, mô tả, nội dung, tag |
| `type` | PostType | Không bắt buộc |
| `status` | `DRAFT` \| `PUBLISHED` \| `ARCHIVED` | Không bắt buộc |
| `limit` | 1..30 | Mặc định 10 |

Trả `[{ id, slug, title, type, status, summary, updatedAt, url }]`.

### `get_post`

| Tham số | Kiểu |
|---|---|
| `id` hoặc `slug` | string |

Trả chi tiết gồm `contentHtml`, ảnh, tag, danh mục, địa chỉ, `updatedAt`.

### `create_post`

| Tham số | Kiểu | Bắt buộc |
|---|---|---|
| `type` | PostType | ✅ |
| `title` | 5..300 ký tự | ✅ |
| `categorySlug` | slug có trong `list_categories` | ✅ |
| `contentMarkdown` hoặc `contentHtml` | ≤ 200.000 ký tự | ✅ (một trong hai) |
| `summary` | ≤ 1.000 | |
| `slug` | ≤ 300 (bỏ trống để tự sinh) | |
| `tags` | tối đa 20 tag | |
| `ward` | tên xã/phường trong `list_wards` | |
| `addressRaw`, `priceRaw`, `areaText`, `bedrooms`, `bathrooms`, `seoTitle` | | |
| `idempotencyKey` | 4..120 ký tự | |

Kết quả: `{ id, slug, status: "DRAFT", title, url, reused }`.

Xử lý phía server:

- Markdown -> HTML (`marked`) -> **sanitize** allowlist (bỏ `<script>`, iframe lạ, sự kiện inline).
- `contentText` sinh tự động; gạch dài được đổi thành `-`; khối "Tags:" bị bỏ.
- `slug` tự sinh từ tiêu đề, thêm `-2`, `-3` nếu trùng.
- Tag tự tạo nếu chưa có. Danh mục **phải tồn tại**.
- `ward` được chuẩn hoá theo 168 xã/phường TP.HCM; `city` luôn là "Thành phố Hồ Chí Minh".
- `extras.agent` lưu token/agent để truy vết trong admin.

### `update_post`

Cập nhật bài đang ở trạng thái `DRAFT`. Truyền `id` hoặc `slug` hiện tại; chỉ các trường được gửi mới thay đổi.

| Tham số | Kiểu | Ghi chú |
|---|---|---|
| `id` hoặc `slug` | string | Chọn bài cần sửa |
| `newSlug` | ≤ 300 | Đổi URL nếu cần |
| `title`, `summary`, `contentMarkdown`, `contentHtml` | | Nội dung mới |
| `categorySlug` | slug có trong `list_categories` | |
| `tags` | tối đa 20 tag | |
| `ward`, `addressRaw`, `priceRaw`, `areaText`, `bedrooms`, `bathrooms`, `seoTitle` | | |

Kết quả: `{ id, slug, title, status, url }`.

Lưu ý: không sửa được bài `PUBLISHED`/`ARCHIVED`; dùng `set_post_status` để đổi trạng thái trước nếu thật sự cần. Đổi `title` không tự đổi URL; muốn đổi URL phải truyền `newSlug`.

### `set_post_status`

| Tham số | Kiểu | Ghi chú |
|---|---|---|
| `id` hoặc `slug` | string | Chọn bài |
| `status` | `PUBLISHED` \| `DRAFT` \| `ARCHIVED` | Trạng thái mới |

Cần scope `posts:publish`. `ARCHIVED` là cách ẩn bài an toàn, có thể khôi phục; không xoá dữ liệu.

Kết quả: `{ id, slug, title, status, url }`.

### `delete_post`

| Tham số | Kiểu | Ghi chú |
|---|---|---|
| `id` hoặc `slug` | string | Chọn bài |
| `confirmSlug` | string | Phải trùng đúng slug hiện tại |

Chỉ ADMIN, cần scope `posts:write`. Đây là xoá vĩnh viễn, không hoàn tác. Nếu chỉ muốn ẩn bài, dùng `set_post_status` với `ARCHIVED`.

Kết quả: `{ id, slug, title, status, deleted: true }`.

## 5. Mã lỗi

Lỗi xác thực trả ở tầng HTTP:

| HTTP | Khi nào | Header |
|---|---|---|
| 401 | Thiếu/sai/hết hạn/thu hồi token | `WWW-Authenticate: Bearer resource_metadata="..."` |
| 403 | Host/Origin không hợp lệ (DNS rebinding protection) | |
| 405 | Gọi `GET`/`DELETE` vào `/mcp` | `Allow: POST` |
| 429 | Vượt `MCP_RATE_LIMIT_PER_MIN` | `Retry-After` |

Lỗi nghiệp vụ trả trong kết quả tool (`isError: true`, JSON có `error.code`):

| Code | Ý nghĩa |
|---|---|
| `FORBIDDEN` | Token thiếu scope cần thiết |
| `INVALID_INPUT` | Thiếu/sai tham số |
| `INVALID_CATEGORY` | Danh mục không tồn tại (kèm gợi ý) |
| `INVALID_WARD` | Xã/phường không thuộc danh mục (kèm gợi ý) |
| `QUOTA_EXCEEDED` | Vượt `MCP_DAILY_POST_LIMIT` bài/ngày |
| `NOT_FOUND` | Không tìm thấy bài |
| `POST_NOT_DRAFT` | Chỉ được sửa bài DRAFT |
| `CONFIRM_MISMATCH` | `confirmSlug` không khớp slug của bài cần xoá |

## 6. Giới hạn và an toàn

- `MCP_RATE_LIMIT_PER_MIN` (mặc định 60) request/phút cho mỗi token.
- `MCP_DAILY_POST_LIMIT` (mặc định 200) bài/ngày cho mỗi token.
- Token lưu dạng hash `sha256(pepper + secret)`, có hạn dùng, thu hồi tức thì, ghi `lastUsedAt`.
- Audit log lưu tham số đã rút gọn (≤ 4KB), không lưu toàn bộ nội dung bài.
- Body tối đa 4MB (đủ cho bài dài); ảnh chưa hỗ trợ ở Phase 1.

## 7. Xử lý sự cố

| Hiện tượng | Nguyên nhân thường gặp |
|---|---|
| 401 `Thiếu token` | Client chưa gửi header hoặc dùng `?token=` (không được phép) |
| 401 `Token đã bị thu hồi` | Tạo token mới trong `/quan-tri/agent-tokens` |
| 403 | `MCP_ALLOWED_HOSTS`/`MCP_PUBLIC_URL` chưa khớp domain đang gọi |
| 429 | Chờ `Retry-After` hoặc tăng `MCP_RATE_LIMIT_PER_MIN` |
| Tool trả `INVALID_CATEGORY` | Gọi `list_categories` để lấy slug đúng |
| Tool trả `INVALID_WARD` | Gọi `list_wards` rồi truyền đúng tên |
| Client không thấy tool | Kiểm tra `Accept: application/json, text/event-stream` và URL `/mcp` |

Kiểm thử nhanh toàn bộ luồng:

```bash
npm run verify:mcp
```
