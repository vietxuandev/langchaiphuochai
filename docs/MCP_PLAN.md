# Kế hoạch: MCP server cho AI agent tạo nội dung

> Trạng thái: **bản kế hoạch, chưa implement**. Ngày đề xuất: 2025-11.
> Mục tiêu: cho AI agent (Claude Code, Cursor, VS Code, n8n, script tự viết) kết nối vào website để
> **tạo/sửa nội dung tự động**, có xác thực, có kiểm soát và audit.

---

## 1. Mục tiêu và phạm vi

### Trong phạm vi

- MCP server (Model Context Protocol) chạy cùng API, dùng transport **Streamable HTTP**.
- Xác thực bằng **personal access token** (PAT) có scope, cấp/thu hồi trong trang quản trị.
- Bộ tool đủ để agent: tra danh mục/tag, kiểm tra trùng, tạo bài nháp, cập nhật, tải ảnh, (tuỳ chọn) xuất bản.
- Audit log + rate limit + idempotency để agent chạy lại không sinh dữ liệu rác.
- Tài liệu cấu hình client + script kiểm thử end-to-end.

### Ngoài phạm vi (giai đoạn sau)

- OAuth 2.1 đầy đủ cho client desktop (Claude Desktop/ChatGPT connector) - có thiết kế ở Phase 3.
- Agent tự tạo danh mục mới, tự đổi vai trò người dùng, tự gọi crawl.
- Giao diện chat trong admin (chỉ cung cấp MCP cho agent bên ngoài).

---

## 2. Hiện trạng hệ thống (tái dùng được gì)

| Thành phần | Trạng thái | Dùng cho MCP |
|---|---|---|
| `apps/api` NestJS + Express | có | gắn route `/mcp` vào cùng process |
| Prisma + PostgreSQL | có | thêm 3 model: token, audit, idempotency |
| `PostsService.create/update` | có (slug tự sinh, tag connectOrCreate, ảnh nested, notify) | gọi lại, không viết logic mới |
| `UploadsService.save` | có (`/upload/posts/...`, giới hạn 10MB, allowlist MIME) | tool `upload_image` |
| `@phuochai/shared` | có (`slugify`, `WARDS` 168, `stripTagsText`, zod schema) | validate đầu vào, chuẩn hoá địa chỉ |
| `NotificationsService` + Telegram | có | báo admin khi agent tạo/xuất bản bài |
| `LoginAttempt` | có | mẫu để làm `McpAuditLog` |
| Auth JWT + RBAC | có | tái dùng khái niệm user/role; token map về user thật |
| Docker compose + Coolify | có | không thêm service, chỉ thêm domain cho `api` |

Chưa có: `@modelcontextprotocol/sdk`, thư viện Markdown/sanitize.

---

## 3. Kiến trúc đề xuất

### 3.1 So sánh phương án

| Phương án | Ưu điểm | Nhược điểm | Kết luận |
|---|---|---|---|
| **A. Module MCP trong `apps/api`** (route `/mcp`) | dùng lại toàn bộ service + validation + upload; 1 image, 1 deploy; audit cùng chỗ | MCP và GraphQL chung process; cần cấu hình route riêng | **Chọn** |
| B. Service riêng `apps/mcp` gọi lại GraphQL | cô lập, tự scale, restart riêng | thêm service + token nội bộ + 1 network hop; validation lặp lại | Phase sau nếu cần tách |
| C. MCP nói trực tiếp Prisma | nhanh | bỏ qua business rule (slug, notify, media, address), dễ hỏng dữ liệu | **Không** |

### 3.2 Sơ đồ

```
AI agent (Claude Code / Cursor / n8n / script)
        │  HTTP + Authorization: Bearer phca_...
        ▼
https://mcp.langchaiphuochai.com  ──►  api:4000  /mcp   (Streamable HTTP)
                                             │
                                  ┌──────────┴───────────┐
                                  │ McpAuthGuard          │ token -> user + scopes
                                  │ RateLimit + Audit     │
                                  └──────────┬───────────┘
                                             ▼
                        PostsService / UploadsService / Prisma / zodschema
                                             │
                                             ▼
                         PostgreSQL + /upload (volume) + Telegram notify
```

### 3.3 Transport và giao thức

- **Streamable HTTP**, chế độ **stateless** (`sessionIdGenerator: undefined`): mỗi lần gọi tool độc lập,
  không giữ session trong RAM, sống sót qua restart và chạy tốt sau proxy.
- Pin protocol version theo SDK (`@modelcontextprotocol/sdk` ~1.32.x), bật kiểm tra Origin/Host
  (`enableDnsRebindingProtection`) vì server mở ra internet.
- Trả cả JSON và SSE theo yêu cầu client (SDK tự xử lý).
- Endpoint phụ: `GET /.well-known/oauth-protected-resource` (và biến thể `/mcp`) trả metadata theo
  RFC 9728 để client OAuth sau này tự khám phá, kể cả khi giai đoạn 1 chỉ dùng PAT.

---

## 4. Xác thực và phân quyền

### 4.1 Token cho agent (Phase 1)

- Định dạng: `phca_<id>_<secret>`, **chỉ hiện 1 lần** khi tạo.
- Lưu DB: `id`, `prefix` (để hiển thị `phca_ab12cd34...`), `secretHash = sha256(pepper + secret)`,
  `scopes[]`, `expiresAt`, `lastUsedAt`, `revokedAt`.
- So sánh bằng `timingSafeEqual`, luôn hash trước khi so.
- Mọi request phải có header `Authorization: Bearer <token>`; token không được đặt trong query string.
- Token gắn với **một user thật** (mặc định admin). Bài do agent tạo có `authorId` = user đó, kèm
  `extras.agent = { tokenId, agentName, client }` để truy vết.

### 4.2 Scope

| Scope | Cho phép |
|---|---|
| `posts:read` | đọc bài, danh mục, tag, xã/phường, tìm kiếm |
| `posts:write` | tạo/sửa bài ở trạng thái **DRAFT** |
| `posts:publish` | xuất bản / thu hồi bài |
| `media:write` | tải ảnh, gắn ảnh vào bài |

Mặc định token mới: `posts:read` + `posts:write` + `media:write`, **không** có `posts:publish`.
Muốn agent tự đăng thì admin bật thêm scope (và có thể tắt bằng biến môi trường `MCP_ALLOW_PUBLISH=false`).

### 4.3 Phản hồi lỗi theo spec

- Thiếu/sai token: `401` + `WWW-Authenticate: Bearer resource_metadata="https://mcp.../.well-known/oauth-protected-resource", scope="posts:read posts:write"`.
- Thiếu scope: `403` + `WWW-Authenticate: Bearer error="insufficient_scope", scope="posts:publish", resource_metadata="..."`.
- Vượt rate limit: `429` + `Retry-After`.

### 4.4 Rate limit và audit

- Giới hạn theo token: mặc định 60 request/phút, 200 bài/ngày, 20 ảnh/bài (cấu hình qua env).
- Bộ đếm trong RAM + đối chiếu `McpAuditLog` (1 instance nên đủ); trả `429` khi vượt.
- Audit mỗi lần gọi tool: token, user, tool, tham số (rút gọn ≤ 4KB), kết quả, `postId`, IP hash,
  userAgent, thời gian xử lý. Admin xem được trong trang quản trị (Phase 2).

---

## 5. Bộ tool đề xuất

### Phase 1 (bắt buộc)

| Tool | Scope | Mô tả |
|---|---|---|
| `whoami` | bất kỳ token hợp lệ | trả user, scope, giới hạn, quy ước nội dung |
| `list_categories` | `posts:read` | id/slug/tên/loại/danh mục cha để agent chọn đúng |
| `list_wards` | `posts:read` | 168 xã/phường TP.HCM (validate trước khi tạo) |
| `search_posts` | `posts:read` | tìm theo keyword/slug/loại để **tránh tạo trùng** |
| `get_post` | `posts:read` | chi tiết bài (nội dung, ảnh, meta) |
| `create_post` | `posts:write` | tạo bài **DRAFT**; nhận `contentMarkdown` hoặc `contentHtml` |

### Phase 2

| Tool | Scope | Mô tả |
|---|---|---|
| `update_post` | `posts:write` | sửa bài; `expectedUpdatedAt` để chống ghi đè |
| `publish_post` | `posts:publish` | DRAFT → PUBLISHED (có kiểm tra nội dung tối thiểu) |
| `unpublish_post` | `posts:publish` | PUBLISHED → DRAFT |
| `upload_image` | `media:write` | từ URL (chặn SSRF) hoặc base64 (≤ 7.5MB) |
| `attach_media` | `media:write` | gắn ảnh vào bài, thứ tự, alt, role |
| `list_tags` | `posts:read` | gợi ý tag đã có để tái dùng |

### Resources và prompts (Phase 2, tăng chất lượng nội dung)

- Resource: `site://brand` (tên miền, hotline, địa chỉ), `site://content-guidelines` (quy ước:
  không gạch dài, địa chỉ theo xã/phường, giá VND...), `site://categories`.
- Prompt: `write-article`, `write-listing`, `seo-meta` hướng dẫn agent viết đúng cấu trúc.
- `instructions` trong `initialize`: mô tả workflow "luôn tạo DRAFT, kiểm tra trùng trước, không bịa số liệu".

---

## 6. Thay đổi dữ liệu

```prisma
model ApiToken {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name       String                 // "Claude Code - laptop"
  prefix     String                 // hiển thị: phca_ab12cd34
  secretHash String                 // sha256(pepper + secret)
  scopes     String[]  @default([])
  agentName  String?
  expiresAt  DateTime?
  lastUsedAt DateTime?
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())

  @@index([userId])
  @@map("api_tokens")
}

model McpAuditLog {
  id         String   @id @default(cuid())
  tokenId    String?
  userId     String?
  tool       String
  status     String                 // ok | error | denied
  errorCode  String?
  postId     String?
  durationMs Int      @default(0)
  args       Json?
  ipHash     String?
  userAgent  String?
  createdAt  DateTime @default(now())

  @@index([createdAt])
  @@index([tokenId, createdAt])
  @@map("mcp_audit_logs")
}

model McpIdempotency {
  id        String   @id @default(cuid())
  tokenId   String
  key       String
  postId    String?
  createdAt DateTime @default(now())

  @@unique([tokenId, key])
  @@index([createdAt])
  @@map("mcp_idempotency")
}
```

Không đổi bảng `posts` (dùng `extras.agent` cho truy vết, tránh migration rộng).
Migration mới: 1 file `*_mcp_tokens_audit`.

---

## 7. Quy trình nội dung (agent viết bài)

1. `whoami` → biết scope và giới hạn.
2. `search_posts` + `list_categories` + `list_wards` → chọn đúng loại, tránh trùng.
3. `create_post` với `contentMarkdown`:
   - Markdown → HTML (`marked`), rồi **sanitize** (`sanitize-html`) theo allowlist:
     `p, h2, h3, ul, ol, li, strong, em, a[href], img[src], blockquote, table, figure`;
     iframe chỉ cho phép YouTube/Google Maps.
   - `contentText` sinh bằng `stripTagsText`; title/summary chuẩn hoá gạch dài như seed.
   - `slug` = `slugify(title)`, tự thêm `-2`, `-3` nếu trùng.
   - `categorySlug` phải tồn tại (không tự tạo danh mục); `tags[]` tự tạo nếu chưa có;
     `ward` phải thuộc 168 xã/phường.
   - Ảnh: nhận `images: [{ url | base64, alt }]` → tải về `/upload/posts/...` (Phase 2) hoặc
     `attach_media` sau khi upload.
4. Trạng thái luôn là **DRAFT**; admin review trong `/quan-tri/bai-viet`.
5. Nếu token có `posts:publish` (và env cho phép) thì agent gọi `publish_post`; mỗi lần xuất bản
   gửi thông báo Telegram cho admin.

---

## 8. An toàn và chống lạm dụng

| Rủi ro | Biện pháp |
|---|---|
| Token lộ | chỉ hiện 1 lần, hash trong DB, hạn dùng, thu hồi tức thì, audit theo token, ghi log `lastUsedAt` |
| SSRF qua `upload_image` (URL nội bộ) | chỉ http/https, resolve DNS rồi chặn private/loopback/link-local, giới hạn redirect, timeout 15s, allowlist domain tuỳ chọn |
| Nội dung XSS từ agent | sanitize allowlist, không cho `<script>`, không cho sự kiện inline |
| Prompt injection trong nội dung crawl | nội dung là **dữ liệu**, không phải chỉ thị; tool không tự chạy lệnh từ nội dung |
| Agent tạo hàng loạt bài rác | rate limit + quota ngày + idempotency + mặc định DRAFT |
| Ghi đè bài của người khác | `expectedUpdatedAt` (optimistic lock) + kiểm tra quyền sở hữu |
| Ảnh phình dung lượng | giới hạn 10MB/ảnh, 20 ảnh/bài, cảnh báo dung lượng trong admin |
| Lộ thông tin qua lỗi | lỗi trả mã + thông điệp ngắn, chi tiết vào audit log |
| MCP SDK thay đổi spec | pin version, có script kiểm thử handshake/tool list |

---

## 9. Hạ tầng và triển khai

- **Không thêm service**: gắn `POST/GET /mcp` vào `apps/api` (Express), cùng image.
- Domain: tạo `mcp.langchaiphuochai.com` trỏ về service `api` port `4000` trong Coolify.
  - Phương án dự phòng: thêm rewrite `/mcp` ở web → api (cần test kỹ SSE/streaming qua Next proxy).
- Biến môi trường mới (thêm vào `.env.coolify.example`):

```bash
# MCP server cho AI agent
MCP_PUBLIC_URL=https://mcp.langchaiphuochai.com   # dùng cho resource metadata + WWW-Authenticate
MCP_ENABLED=true
MCP_RATE_LIMIT_PER_MIN=60
MCP_DAILY_POST_LIMIT=200
MCP_MAX_IMAGES_PER_POST=20
MCP_ALLOW_PUBLISH=false                            # true = cho token có scope publish xuất bản thật
MCP_TOKEN_PEPPER=                                  # chuỗi ngẫu nhiên, thêm vào khi hash token
```

- Trang quản trị mới: `/quan-tri/agent-tokens` (ADMIN): tạo token (chọn scope, hạn, tên agent),
  copy 1 lần, xem `lastUsedAt`, thu hồi; tab "Nhật ký MCP" xem audit.
- Tài liệu: `docs/MCP.md` + mục trong README.

---

## 10. Các phase, deliverable và thời lượng

| Phase | Nội dung | Deliverable | Ước lượng |
|---|---|---|---|
| **P1 - Nền tảng** | Prisma 3 model + migration; `ApiTokensService`; `McpModule` (Streamable HTTP, stateless); auth guard + 401/403 + PRM metadata; rate limit + audit; tool `whoami`, `list_categories`, `list_wards`, `search_posts`, `get_post`, `create_post` (Markdown + sanitize, DRAFT); UI tạo/thu hồi token | API chạy `/mcp`, tạo được bài nháp từ agent | ~1,5 ngày |
| **P2 - Đầy đủ** | `update_post`, `publish_post`, `unpublish_post`, `upload_image` (SSRF guard), `attach_media`, `list_tags`; resources + prompts; trang nhật ký MCP; thông báo Telegram khi agent xuất bản | Agent viết + đăng bài hoàn chỉnh | ~1 ngày |
| **P3 - OAuth 2.1** | `/authorize`, `/token`, PKCE S256, refresh token, DCR hoặc client đăng ký trước, consent dùng login admin, map scope; cập nhật PRM `authorization_servers` | Kết nối được từ client chỉ hỗ trợ OAuth (Claude Desktop, ChatGPT connector) | ~1,5-2 ngày |
| **P4 - Hoàn thiện** | `docs/MCP.md` (Claude Code, Cursor, VS Code, n8n), script `verify:mcp` vào `verify:all`, cấu hình Coolify, checklist deploy | Bàn giao + kiểm thử tự động | ~0,5 ngày |

Tổng: **~4,5-5 ngày** làm việc, chia 4 phase; P1 có thể dùng ngay để viết nội dung.

---

## 11. Kiểm thử

- **Tự động** `scripts/verify-mcp.mjs` (JSON-RPC trực tiếp, không cần SDK):
  1. `initialize` + `tools/list` trả đúng danh sách tool.
  2. Không token → 401 kèm `WWW-Authenticate`.
  3. Token thiếu scope `posts:publish` → 403 `insufficient_scope`.
  4. `create_post` với Markdown → bài DRAFT trong DB, `contentHtml` đã sanitize, slug chuẩn, tag nối đúng.
  5. Gọi lại cùng `Idempotency-Key` → không tạo bài thứ 2.
  6. `publish_post` có scope → status PUBLISHED + notification.
  7. Vượt rate limit → 429.
  8. Dọn dữ liệu kiểm thử (như `verify:mutations`).
- **Thủ công**: `npx @modelcontextprotocol/inspector` kết nối `https://mcp.../mcp` với header Bearer.
- **Client thật**: Claude Code (`.mcp.json`), Cursor (`mcp.json`), n8n HTTP Request (MCP).
- Đưa `verify:mcp` vào `npm run verify:all` để chặn hồi quy.

---

## 12. Rủi ro và cách giảm thiểu

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Spec MCP còn thay đổi (bản 2025-11-25) | trung bình | pin SDK, tách lớp transport khỏi tool, kiểm thử handshake |
| OAuth phức tạp, dễ sai | trung bình | làm sau (P3), tái dùng login admin, PKCE + resource param theo spec |
| Agent viết nội dung kém/sai | cao | prompt + resource hướng dẫn, mặc định DRAFT, admin duyệt |
| Trùng lặp nội dung | trung bình | `search_posts` bắt buộc trong hướng dẫn, idempotency key |
| Ảnh dung lượng lớn | thấp | giới hạn kích thước/số lượng, báo dung lượng |
| Proxy chặn streaming | thấp | dùng domain riêng cho API, không qua Next |

---

## 13. Cần bạn quyết trước khi implement

1. **Client chính** là gì? (Claude Code/Cursor/n8n/script → PAT là đủ; cần Claude Desktop/ChatGPT → phải làm P3 OAuth)
2. Agent có được **xuất bản trực tiếp** không, hay chỉ tạo **DRAFT** để bạn duyệt? (đề xuất: chỉ DRAFT ở P1, bật publish ở P2 theo nhu cầu)
3. Nội dung agent gửi: **Markdown** (đề xuất) hay HTML?
4. Cho phép agent **tự tạo tag** (đề xuất: có) và **tự tạo danh mục** (đề xuất: không)?
5. Ảnh: cho tải từ **URL** (cần chặn SSRF, đề xuất: có ở P2) hay chỉ base64/upload tay?
6. Có cần **giới hạn** cụ thể: bao nhiêu bài/ngày, bao nhiêu token, hạn token mặc định?
7. Domain MCP: `mcp.langchaiphuochai.com` (đề xuất, cần thêm DNS) hay `/mcp` trên domain chính (không cần DNS nhưng phải qua proxy Next)?
8. Có muốn **thông báo Telegram** mỗi khi agent tạo/xuất bản bài (đang có sẵn hệ thống) hay chỉ ghi audit?

---

## Phụ lục A. Cấu hình client (dự kiến)

```jsonc
// Claude Code: .mcp.json
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

```jsonc
// Cursor: ~/.cursor/mcp.json (cùng cấu trúc)
// VS Code (settings.json -> mcp.servers) hoặc n8n HTTP Request node với 2 header:
//   Content-Type: application/json
//   Authorization: Bearer phca_xxx_yyy
```

## Phụ lục B. Ví dụ một tool call

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "create_post",
    "arguments": {
      "type": "NEWS",
      "title": "Ăn gì ở Phước Hải buổi sáng? 5 món dân địa phương hay ăn",
      "summary": "Gợi ý 5 món ăn sáng bình dân ở Phước Hải, kèm địa chỉ và giá tham khảo.",
      "contentMarkdown": "## 1. Bánh canh chả cá\\n\\nQuán nhỏ trên đường...",
      "categorySlug": "an-uong",
      "tags": ["ăn sáng", "hải sản"],
      "ward": "Xã Phước Hải",
      "idempotencyKey": "news-an-sang-2025-11"
    }
  }
}
```

## Phụ lục C. Phản hồi lỗi

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://mcp.langchaiphuochai.com/.well-known/oauth-protected-resource",
                         scope="posts:read posts:write"
```

```http
HTTP/1.1 403 Forbidden
WWW-Authenticate: Bearer error="insufficient_scope", scope="posts:publish",
                         resource_metadata="https://mcp.langchaiphuochai.com/.well-known/oauth-protected-resource"
```
