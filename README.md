# Làng Chài Phước Hải - Website danh bạ lưu trú & du lịch

Website chính thức của **Làng Chài Phước Hải** (domain **langchaiphuochai.com**), xây dựng lại hoàn toàn
với bộ nhận diện mới, giao diện và bố cục hiện đại hơn, sử dụng dữ liệu đã được chuẩn hoá
(406 bài viết, 41 danh mục, 587 ảnh).

> **Đã tách hoàn toàn khỏi website cũ**: không còn liên kết, hình ảnh hay trường dữ liệu nào trỏ tới domain cũ.
> Toàn bộ ảnh được phục vụ từ thư mục `upload/` của máy chủ mới, kèm chức năng upload ảnh trong trang quản trị.

| Thành phần | Công nghệ |
| --- | --- |
| **Backend** | NestJS 11 + TypeScript + GraphQL (Apollo Server, code-first) + Prisma + PostgreSQL 16 |
| **Frontend** | Next.js 15 (App Router) + TypeScript + Apollo Client + Tailwind CSS + shadcn/ui |
| **API ảnh** | REST multipart `POST /api/upload` (Multer) → lưu vào `upload/<folder>/<năm>/<tháng>/` |
| **Data layer** | GraphQL Codegen (sinh type + React hook) |
| **Địa chỉ** | 168 xã/phường/đặc khu của TP. Hồ Chí Minh (dropdown autocomplete, không còn quận/huyện) |
| **Form & validate** | react-hook-form + **zod dùng chung cho cả FE và BE** (`packages/shared`) |
| **Bảng dữ liệu** | TanStack Table 8 (sắp xếp, lọc, phân trang) |
| **Soạn thảo nội dung** | Tiptap 3 (WYSIWYG) - thay cho việc gõ HTML thủ công |
| **Phân quyền** | 3 vai trò: `ADMIN` (quản trị) · `EDITOR` (người đăng bài) · `USER` (thành viên) |
| **Hạ tầng** | Docker Compose (PostgreSQL + API + Web), hoặc chạy local không cần Docker |

---

## 1. Thông tin thương hiệu

| | |
| --- | --- |
| Tên website | **Làng Chài Phước Hải** |
| Domain | **langchaiphuochai.com** |
| Hotline | **0869 123 020** |
| Zalo | 0869 123 020 (`https://zalo.me/0869123020`) |
| Email | lienhe@langchaiphuochai.com |
| Địa chỉ | Xã Phước Hải, TP. Hồ Chí Minh |

Toàn bộ thông tin trên nằm ở **một chỗ duy nhất**: `packages/shared/src/brand.ts` (`BRAND`).
Đổi số điện thoại/domain chỉ cần sửa file đó (và biến `NEXT_PUBLIC_SITE_URL` khi triển khai).

---

## 2. Kiến trúc

```
phuochai-web/
├── docker-compose.yml          # db + api + web (+ service seed để import dữ liệu)
├── packages/shared/            # @phuochai/shared: BRAND, enum, zod schema, tiện ích dùng chung
├── apps/api/                   # NestJS + GraphQL + Prisma
│   ├── prisma/schema.prisma    # User, Category, Post, PostImage, Tag, ImportRun
│   ├── prisma/migrations/      # migration khởi tạo (dùng cho `prisma migrate deploy`)
│   ├── prisma/seed.ts          # Import dữ liệu crawl (idempotent, có --fresh / --limit)
│   ├── schema.graphql          # Schema GraphQL sinh tự động → dùng cho codegen
│   └── src/
│       ├── auth/               # JWT, đăng nhập/đăng ký, đổi mật khẩu
│       ├── users/              # Quản lý người dùng & phân quyền (ADMIN)
│       ├── categories/         # Cây danh mục nhiều cấp
│       ├── posts/              # Bài viết: lọc, phân trang, CRUD, xuất bản
│       ├── uploads/            # ⭐ API upload ảnh (REST, multipart) + xoá ảnh
│       ├── stats/              # Thống kê dashboard + thống kê công khai
│       └── common/             # Guards (JWT + Roles), ZodPipe, scalar JSON
└── apps/web/                   # Next.js App Router
    ├── codegen.ts              # Cấu hình GraphQL Code Generator
    ├── src/app/(site)/         # Trang công khai (SSR)
    ├── src/app/(auth)/         # Đăng nhập / đăng ký
    ├── src/app/quan-tri/       # Khu vực quản trị
    ├── src/components/ui/      # 28 component shadcn/ui
    ├── src/components/site/    # Component giao diện công khai
    ├── src/components/admin/   # Component khu vực quản trị (có form upload ảnh)
    ├── src/graphql/            # Document GraphQL
    └── src/generated/          # Type + hook do codegen sinh ra
```

---

## 3. Hình ảnh & upload (điểm thay đổi chính)

**Ảnh cũ** (từ website cũ) đã được tải về và **phục vụ từ máy chủ mới**:

- Thư mục lưu: `data/upload/` (mount vào API, phục vụ tại `/upload/...`).
- Database chỉ lưu **một trường `path`** dạng `/upload/<folder>/<năm>/<tháng>/<tên-file>.<ext>`.
- `contentHtml` của bài viết cũng đã được viết lại: mọi ảnh trỏ về `/upload/...`, mọi link nội bộ
  chuyển sang đường dẫn mới (`/luu-tru/...`, `/tin-tuc/...`, `/danh-muc/...`, `/tim-kiem?q=...`),
  link tới domain cũ và domain template cũ đã bị loại bỏ.

**Chức năng upload ảnh cho API mới**:

```http
POST /api/upload?folder=posts        # multipart/form-data, field "file", cần Bearer token
→ 201 { "path": "/upload/posts/2026/10/anh-1a2b3c4d.jpg", "bytes": 135013, "mimeType": "image/jpeg", "originalName": "anh.jpg" }

DELETE /api/upload?path=/upload/posts/2026/10/anh-1a2b3c4d.jpg   # cần vai trò EDITOR trở lên
```

| Quy tắc | Giá trị |
| --- | --- |
| Thư mục cho phép | `posts`, `categories`, `avatars` |
| Định dạng | JPG, PNG, WEBP, GIF, AVIF |
| Dung lượng tối đa | 10MB/ảnh |
| Bảo mật | Bắt buộc đăng nhập; kiểm tra MIME thật, chống path traversal khi xoá |
| Tên file | Sinh tự động từ tên gốc (bỏ dấu) + mã ngẫu nhiên, tránh trùng và an toàn trên mọi hệ điều hành |

### Mọi field ảnh trong hệ thống đều dùng upload

| Vị trí | Field | Cách nhập |
| --- | --- | --- |
| Bài viết → **Thư viện ảnh** | `images[]` (nhiều ảnh, có vai trò) | ✅ Chọn nhiều file từ máy → tự upload |
| Bài viết → **Nội dung** (editor) | ảnh trong `contentHtml` | ✅ Nút **Chèn ảnh từ máy tính** trên thanh công cụ editor |
| Bài viết → SEO | `heroImage` lấy từ ảnh đại diện | ✅ Không cần nhập riêng |
| **Danh mục** → Ảnh đại diện danh mục | `Category.imagePath` | ✅ Ô chọn ảnh có xem trước (upload vào `upload/categories/`) |
| **Tài khoản** → Ảnh đại diện | `User.avatarUrl` | ✅ Ô chọn ảnh vuông (upload vào `upload/avatars/`), hiển thị ở header + bảng người dùng |

Component dùng chung: `apps/web/src/components/ui/image-upload-field.tsx`
(xem trước ảnh, nút **Tải ảnh lên / Đổi ảnh khác**, nút **Xoá ảnh**, tuỳ chọn nhập đường dẫn thủ công cho người rành kỹ thuật).

**Ràng buộc ở backend**: mọi trường ảnh (`avatarUrl`, `imagePath`, `images[].path`) chỉ chấp nhận đường dẫn
bắt đầu bằng `/upload/` - ảnh từ domain cũ hoặc nguồn ngoài bị từ chối kèm thông báo tiếng Việt.
Quy ước cập nhật: gửi chuỗi rỗng `""` để **xoá ảnh**, bỏ trống field để **giữ nguyên** ảnh hiện có.

---

## 4. Địa chỉ: xã/phường TP. Hồ Chí Minh (bỏ cấp quận/huyện)

Việt Nam đã bỏ cấp quận/huyện từ 01/07/2025 và website chỉ phục vụ TP. Hồ Chí Minh, nên địa chỉ chỉ còn **3 phần**:

```
địa chỉ chi tiết (số nhà, đường, khu phố)  →  xã/phường  →  Thành phố Hồ Chí Minh
```

| Hạng mục | Chi tiết |
| --- | --- |
| Dữ liệu | `packages/shared/src/data/hcm-wards.json` - **168** đơn vị (113 phường, 54 xã, 1 đặc khu Côn Đảo), mã tỉnh 79 |
| Nhập liệu | Component `WardCombobox`: dropdown **autocomplete**, tìm **không cần dấu** ("phuoc hai" → Xã Phước Hải), chọn bằng bàn phím (↑ ↓ Enter Esc) |
| Tỉnh/thành | Ô cố định "Thành phố Hồ Chí Minh" (chỉ hỗ trợ 1 tỉnh) |
| Quận/huyện | **Đã bỏ** khỏi database, GraphQL và giao diện |
| Bộ lọc | Thay lọc "Khu vực" bằng lọc **Xã/phường** (query param `xa-phuong`); giá trị lạ trên URL bị bỏ qua, không gây lỗi |
| Kiểm tra dữ liệu | API chỉ nhận xã/phường có trong danh mục; `city` chỉ nhận "Thành phố Hồ Chí Minh" - sai sẽ báo lỗi tiếng Việt rõ ràng |

**Migration dữ liệu cũ**:

```bash
npm run db:seed                        # import lại: tự chuẩn hoá ward/city + tách địa chỉ chi tiết
npm run migrate:addresses              # xem trước thay đổi trên dữ liệu hiện có
npm run migrate:addresses -- --apply   # áp dụng cho dữ liệu nhập tay
# gán xã/phường cho những bài còn trống (ví dụ dữ liệu cũ không ghi xã/phường):
npm run migrate:addresses -- --apply --default-ward="Xã Phước Hải"
```

Chuẩn hoá gồm: `ward` → tên chuẩn trong 168 đơn vị (chấp nhận "Phước Hải", "xa phuoc hai"),
`city` → "Thành phố Hồ Chí Minh", `addressRaw` → chỉ giữ phần chi tiết
(ví dụ `"khu phố Hải Sơn, Xã Phước Hải, Thành Phố Hồ Chí Minh"` → `"khu phố Hải Sơn"`).

---

## 5. Soạn thảo nội dung bằng editor trực quan (Tiptap)

Người không rành kỹ thuật soạn bài **trực tiếp như Word**, không cần gõ HTML:

| Nhóm chức năng | Chi tiết |
| --- | --- |
| Định dạng chữ | In đậm, nghiêng, gạch chân, gạch ngang, chữ nổi bật (code), xoá định dạng |
| Cấu trúc | Đoạn văn / Tiêu đề H2-H3-H4, danh sách dấu đầu dòng, danh sách đánh số, trích dẫn, khối mã, đường kẻ ngang |
| Căn lề | Trái, giữa, phải, căn đều hai bên |
| Chèn ảnh | Chọn nhiều ảnh từ máy → tự tải lên thư mục `upload/` của máy chủ → chèn vào đúng vị trí con trỏ |
| Liên kết | Dialog chèn/sửa/bỏ liên kết |
| Bảng biểu | Chèn bảng 3×3, thêm/xoá dòng-cột, bật/tắt dòng tiêu đề, kéo giãn cột |
| Khác | Hoàn tác / làm lại, đếm ký tự & số từ, chữ gợi ý khi bài trống |
| Cho người rành kỹ thuật | Nút **Chế độ HTML** xem/sửa mã nguồn, đồng bộ hai chiều với editor |

**Không mất dữ liệu**: editor được cấu hình đủ extension để giữ nguyên mọi cấu trúc đang có trong
406 bài viết cũ (tiêu đề, danh sách, **bảng**, ảnh, liên kết). Có 2 script kiểm chứng:

```bash
npm run verify:editor          # mô phỏng mở bài cũ bằng editor rồi lưu lại
# → 40/40 bài giữ nguyên cấu trúc (kể cả các bài có bảng)

npm run verify:editor:render   # mount thật editor trong cây provider (happy-dom, không cần trình duyệt)
# → 21 nút thanh công cụ, vùng soạn thảo OK, 0 lỗi runtime

npm run verify                 # chạy typecheck + test mount
npm run verify:avatar          # kiểm tra luồng ảnh đại diện (cần API + web đang chạy)
# → 1) di trú token từ key localStorage bản cũ  2) khôi phục avatar sau reload
#   3) lưu hồ sơ từ form ghi đúng vào database (giữ nguyên ảnh hiện có, không sửa dữ liệu)

npm run verify:schemas         # kiểm tra schema dùng chung (nhận giá trị rỗng + idempotent)
npm run verify:mutations       # gọi thật toàn bộ 17 mutation: không lỗi 500, dữ liệu đổi đúng, phân quyền đúng
npm run uploads:report         # liệt kê ảnh trong upload/ và phát hiện ảnh rác
npm run uploads:report -- --delete --min-age-hours=24   # xoá ảnh rác cũ hơn 24 giờ
```

> Test `verify:editor:render` được tạo sau khi gặp lỗi thực tế ``Tooltip` must be used within `TooltipProvider``:
> nó dựng DOM bằng happy-dom, render đúng cây `<Providers>` của ứng dụng rồi kiểm tra lỗi console -
> nhờ đó bắt được các lỗi chỉ xuất hiện khi chạy trong trình duyệt. Đã kiểm chứng test này thực sự bắt lỗi
> bằng cách tạm bỏ `TooltipProvider` (test fail đúng thông báo) rồi khôi phục.

Ảnh trong nội dung cũng dùng chung API upload (`/upload/...`) nên bài viết và ảnh đều nằm trên máy chủ mới.

> Ảnh tải lên nhưng chưa bấm **Lưu** sẽ nằm lại trong `upload/` dưới dạng ảnh rác.
> Dùng `npm run uploads:report` để xem và `--delete --min-age-hours=24` để dọn an toàn.

---

## 6. Chạy nhanh

### Cách A - Docker Compose (khuyến nghị)

```bash
cd phuochai-web
cp .env.example .env                  # đổi JWT_SECRET trước khi lên production
npm run data:prepare                  # copy dataset + ảnh vào data/{seed,upload}
npm run docker:up                     # build & chạy PostgreSQL + API + Web
docker compose run --rm seed          # import dữ liệu vào database

# Website: http://localhost:3000   ·   GraphQL: http://localhost:4000/graphql
```

### Cách B - Chạy local (không cần Docker)

```bash
cd phuochai-web
npm install                           # (nếu lỗi quyền npm cache: npm_config_cache=.npm-cache npm install)

npm run db:local                      # PostgreSQL nhúng tại localhost:55432 (terminal riêng)

npm run data:prepare                  # copy dataset + ảnh vào data/seed và data/upload
npm run db:push                       # tạo bảng (hoặc npm run db:migrate để dùng migration)
npm run db:seed                       # import 406 bài viết + 41 danh mục + 587 ảnh

npm run dev:api                       # http://localhost:4000/graphql
npm run dev:web                       # http://localhost:3000
```

Sinh lại type/hook sau khi đổi GraphQL schema:

```bash
npm run build:shared                            # build package dùng chung
npm run schema:emit -w @phuochai/api             # sinh apps/api/schema.graphql
npm run codegen                                  # sinh apps/web/src/generated/graphql.tsx
```

---

## 7. Tài khoản test

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| **Quản trị viên** | `admin@langchaiphuochai.com` | `Admin@123` |
| **Người đăng bài** | `editor@langchaiphuochai.com` | `Editor@123` |
| **Thành viên** | `user@langchaiphuochai.com` | `User@123` |

Trang đăng nhập có nút **điền nhanh** tài khoản demo. Có thể đổi qua biến môi trường
`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, …

**Nâng cấp database đã có từ bản trước** (đổi email tài khoản sang domain mới, giữ nguyên bài viết):

```sql
UPDATE users SET email = 'admin@langchaiphuochai.com'  WHERE email = 'admin@phuochai.com';
UPDATE users SET email = 'editor@langchaiphuochai.com' WHERE email = 'editor@phuochai.com';
UPDATE users SET email = 'user@langchaiphuochai.com'   WHERE email = 'user@phuochai.com';
```

Bản này cũng đổi schema: ảnh dùng cột `path` (thay cho `url`/`localPath`) và đã bỏ các cột
`legacyUrl`, `canonicalUrl`, `sourceUrl`. Chạy `npm run db:migrate` (hoặc `npm run db:push`) rồi `npm run db:seed`
để cập nhật - seed sẽ ghi lại toàn bộ đường dẫn ảnh sang `/upload/...`.

### Ma trận phân quyền (đã kiểm thử tự động)

| Hành động | USER | EDITOR | ADMIN |
| --- | :---: | :---: | :---: |
| Xem bài đã xuất bản | ✅ | ✅ | ✅ |
| Xem bản nháp của chính mình | ✅ | ✅ | ✅ |
| Xem bản nháp của người khác | ❌ | ✅ | ✅ |
| Tạo bài viết (mặc định bản nháp) | ✅ | ✅ | ✅ |
| Xuất bản bài viết | ❌ | ✅ | ✅ |
| Sửa/xoá bài của chính mình | ✅ | ✅ | ✅ |
| Sửa/xoá bài của người khác | ❌ | ✅ | ✅ |
| Tải ảnh lên (`POST /api/upload`) | ✅ | ✅ | ✅ |
| Xoá ảnh (`DELETE /api/upload`) | ❌ | ✅ | ✅ |
| Quản lý danh mục | ❌ | ❌ | ✅ |
| Quản lý người dùng & phân quyền | ❌ | ❌ | ✅ |

---

## 8. Tính năng

### Trang công khai (SSR - dữ liệu có sẵn trong HTML, tốt cho SEO)

- **Trang chủ**: hero tìm kiếm, thống kê, khối nơi lưu trú xem nhiều, bất động sản mới, cẩm nang du lịch.
- **Nơi lưu trú** `/luu-tru` + `/luu-tru/[slug]`: thư viện ảnh (xem lớn), giá, liên hệ, thông tin chi tiết, bài liên quan.
- **Tin tức** `/tin-tuc` + `/tin-tuc/[slug]`: nội dung HTML đầy đủ với ảnh `/upload/...` và link nội bộ mới.
- **Bất động sản** `/bat-dong-san` + `/bat-dong-san/[slug]`: giá, giá/m², diện tích, hướng, pháp lý…
- **Danh mục** `/danh-muc/[slug]`, **Tìm kiếm** `/tim-kiem?q=`, **Trang tĩnh** `/trang/[slug]`.
- Bộ lọc danh mục/khu vực/khoảng giá/sắp xếp, đồng bộ lên URL, phân trang, chia sẻ bài viết (copy link).

### Khu vực quản trị `/quan-tri`

- **Dashboard**: KPI, phân bố theo loại nội dung, trạng thái xuất bản, bài gần đây.
- **Bài viết**: bảng TanStack (tìm kiếm, lọc, sắp xếp, phân trang, xuất bản/thu hồi/xoá).
- **Form bài viết**: **editor trực quan (Tiptap)** cho nội dung + 4 tab thông tin (địa điểm, giá & diện tích,
  liên hệ, SEO) + **upload ảnh** + tags. Không cần biết HTML.
- **Danh mục** (ADMIN), **Người dùng** (ADMIN), **Tài khoản** (đổi mật khẩu, hồ sơ).
- Dark mode, toast, skeleton, empty state, xác nhận trước khi xoá.

---

## 9. Dữ liệu

| Loại | Số lượng | Danh mục |
| --- | --- | --- |
| Nơi lưu trú | 160 | Bungalow, Căn hộ dịch vụ, Glamping, Homestay, Khách sạn, Nhà nghỉ, Resort, Villa |
| Tin tức & cẩm nang | 180 | Ăn uống, Bãi tắm, Cơ hội đầu tư, Đi lại, Dịch vụ, Điểm tham quan, Lưu trú, Thông tin, Trải nghiệm |
| Bất động sản | 58 | Đất gần biển, Đất nền dự án, Đất trong dân cư, Đất ven biển, Homestay, Nhà gần biển, Nhà phố, Nhà ven biển, Nhà vườn, Villa Biệt thự |
| Trang thông tin | 8 | Giới thiệu, FAQ, Bảng giá dịch vụ… |
| **Tổng** | **406 bài viết** | **41 danh mục** (gồm 11 danh mục lọc theo tỉnh/thành) |

- **587 ảnh** (116 MB) trong `data/upload/`, phục vụ tại `/upload/...`
- **986 tag** bài viết
- Dữ liệu thô để import nằm ở `data/seed/` (sinh ra từ công cụ crawl, không commit vào git)
- `sourceKey` (ví dụ `accommodation:67`) được giữ lại để đối chiếu khi import lại - đây là khoá nội bộ,
  **không** chứa domain cũ.

---

## 10. Kiểm thử

```bash
npm run typecheck     # TypeScript strict cho cả 3 package
npm run build         # build shared → api → web
```

### Bộ lệnh kiểm tra

| Lệnh | Nội dung | Cần gì đang chạy |
| --- | --- | --- |
| `npm run verify` | typecheck 3 package + schema dùng chung + mount editor/ô chọn ảnh | không cần gì |
| `npm run verify:schemas` | schema nhận `''`/`null`/`undefined`, idempotent, vẫn giữ ràng buộc | không cần gì |
| `npm run verify:editor:render` | mount thật editor trong cây provider (happy-dom) | không cần gì |
| `npm run verify:editor` | mở 40 bài cũ bằng editor rồi lưu lại, kiểm tra mất cấu trúc | PostgreSQL |
| `npm run verify:content` | không còn dấu gạch dài (em/en dash) trong database, mã nguồn và README | PostgreSQL |
| `npm run verify:addresses` | cấu trúc + dữ liệu địa chỉ trong DB và helper (168 xã/phường, không còn quận/huyện) | PostgreSQL |
| `npm run verify:queries` | đối chiếu số đếm của API với dữ liệu thật (postCount = số bài khi lọc, tổng danh mục con, publicStats) | API |
| `npm run verify:mutations` | gọi thật **cả 17 mutation**: không lỗi 500, dữ liệu đổi đúng, phân quyền đúng, tự dọn dữ liệu test | API |
| `npm run verify:seed` | chạy lại seed rồi so sánh số lượng bản ghi - bảo đảm không sinh dữ liệu trùng | PostgreSQL |
| `npm run verify:avatar` | upload ảnh mới → đổi avatar → khẳng định DB đổi → khôi phục | API + Web |
| `npm run verify:api` | `verify:queries` + `verify:mutations` + `verify:avatar` | API + Web |
| `npm run verify:all` | tất cả các bộ trên | API + Web + PostgreSQL |
| `npm run strip:tags` | bỏ khối "Tags: ..." còn trong nội dung bài viết (xem trước; `-- --apply` để ghi) | PostgreSQL |
| `npm run uploads:report` | liệt kê ảnh trong `upload/`, phát hiện ảnh rác | PostgreSQL |

Đã xác minh:

- Upload ảnh: 401 khi thiếu token, lưu đúng vào `upload/<folder>/<năm>/<tháng>/`, truy cập được qua `/upload/...`,
  từ chối file không phải ảnh (kèm thông báo tiếng Việt), xoá ảnh thành công.
- Field ảnh: upload + lưu thành công cho **ảnh danh mục** và **ảnh đại diện người dùng**;
  ảnh từ domain cũ/nguồn ngoài bị **từ chối** ở cả 4 trường hợp (avatar, ảnh danh mục, ảnh bài viết);
  gửi chuỗi rỗng để xoá ảnh hoạt động đúng, bỏ trống field thì giữ nguyên giá trị cũ.
- 26 bước kiểm tra mutation (gồm cả các ca lỗi và phân quyền) đều đạt, không có lỗi 500 nào.
- Bộ test RBAC 10 kịch bản qua API thật; import lại dữ liệu `--fresh` idempotent.
- `npm run verify:editor`: mô phỏng mở bài viết cũ bằng editor trực quan rồi lưu lại -
  40/40 bài giữ nguyên cấu trúc (bao gồm cả bảng biểu).

---

## 11. Triển khai (deploy)

Hướng dẫn đầy đủ cho **Coolify**: xem **[DEPLOY.md](DEPLOY.md)**.

Tóm tắt kiến trúc production: chỉ website ra Internet, API và DB chạy trong mạng nội bộ Docker,
trình duyệt gọi API qua chính domain website (`/graphql`, `/api/upload`, `/upload/*`).

| File | Dùng cho |
| --- | --- |
| `docker-compose.coolify.yml` | Server/Coolify (không publish port, secret từ env, có healthcheck) |
| `docker-compose.yml` | Máy local (publish port 3000/4000/5432, bind mount `./data`) |
| `.env.coolify.example` | Danh sách biến môi trường cần đặt trong Coolify |
| `apps/api/Dockerfile`, `apps/web/Dockerfile` | Build image (web nhận `API_INTERNAL_URL`, `NEXT_PUBLIC_*` qua build args) |
| `apps/web/next.config.mjs` | `NEXT_STANDALONE=1` bật `output: 'standalone'` (image web 1.81GB -> 354MB) |
| `.dockerignore` | Loại `node_modules`, `.next`, `data/` (190MB) khỏi build context |

Lệnh hỗ trợ (chạy trên server hoặc máy có Docker):

```bash
docker compose -f docker-compose.coolify.yml config          # kiểm tra biến môi trường
docker compose -f docker-compose.coolify.yml --profile tools run --rm seed   # import dữ liệu
```

Lưu ý quan trọng: `API_INTERNAL_URL` và mọi biến `NEXT_PUBLIC_*` được **nhúng vào bản build**
của Next.js (kiểm tra bằng `apps/web/.next/routes-manifest.json`), nên đổi domain phải **deploy lại**
chứ không chỉ restart.

---

## 12. Xử lý sự cố thường gặp

| Hiện tượng | Nguyên nhân & cách xử lý |
| --- | --- |
| Đổi ảnh đại diện nhưng reload vẫn thấy ảnh cũ | Bản trước bị lỗi schema (xem mục 12). Nếu vẫn gặp: **hard refresh** (Cmd/Ctrl + Shift + R) rồi đăng nhập lại - bản rebrand đã đổi key localStorage nhưng `getToken()` tự di trú từ key cũ. |
| Reload xong chỉ thấy **một khối màu đơn sắc** | Ảnh đang trỏ tới file ảnh trơn (vài trăm byte). Vào **Tài khoản → Ảnh đại diện → Đổi ảnh khác** để thay, hoặc kiểm tra file trong `data/upload/`. |
| Ảnh không hiển thị sau khi upload | Kiểm tra file có trong `data/upload/...` và truy cập được qua `/upload/...`. Ảnh lỗi tự chuyển thành chữ cái đầu thay vì biểu tượng ảnh hỏng. |
| Báo lỗi "Ảnh phải được tải lên máy chủ" | Trường ảnh chỉ nhận đường dẫn `/upload/...`; ảnh từ domain cũ/nguồn ngoài bị chặn có chủ đích. |
| Đổi vai trò người dùng không hoạt động | Đã sửa: `updateUserSchema` thiếu `id` nên zod loại bỏ → Prisma lỗi 500. `npm run verify:mutations` kiểm tra lại. |
| Bấm vào **tag** không ra bài viết nào | Đã sửa: tìm kiếm (`keyword`) chỉ khớp tiêu đề/mô tả/nội dung, chưa khớp **thẻ**, trong khi link tag trỏ tới `/tim-kiem?q=<tên thẻ>`. Giờ `keyword` tìm cả trong `tags`, và `verify:queries` kiểm tra "bấm tag phải thấy chính bài viết đó". |
| Tag bị **hiển thị trùng** trong bài viết (có cả khối "Tags: ..." trong nội dung) | Đã sửa: site cũ chèn danh sách tag vào cuối mỗi bài, trùng với mục tag hiển thị từ quan hệ `Post.tags`. Seed tự bỏ khối này khi import; dữ liệu cũ dọn bằng `npm run strip:tags -- --apply`; `npm run verify:content` kiểm tra lại. |
| Số bài của danh mục hiển thị **0** | Đã sửa: `CategoriesService` hardcode `postCount: 0` cho danh mục con và không include `_count`. Giờ số bài của danh mục = **tổng cả cây** (cha = tổng con). `npm run verify:queries` đối chiếu số đếm với số bài thật. |
| Danh mục bị trùng sau vài lần import | Đã sửa: seed nhận diện theo **(tên + nhóm)** thay vì chỉ slug. `npm run verify:seed` kiểm tra tự động. |
| Nhập xã/phường báo "không có trong danh mục" | Tên phải khớp 168 xã/phường TP. Hồ Chí Minh. Dropdown cho phép tìm không dấu ("phuoc hai"), hoặc chạy `npm run migrate:addresses` để chuẩn hoá dữ liệu cũ. |
| Bộ lọc xã/phường bị "kẹt" sau khi sửa URL | Giá trị lạ trên URL được bỏ qua an toàn; chọn lại trong bộ lọc hoặc xoá query param `xa-phuong`. |
| Muốn dọn ảnh rác | `npm run uploads:report` để xem, `--delete --min-age-hours=24` để xoá an toàn. |

---

## 13. Ghi chú kỹ thuật

- **Zod dùng chung**: `packages/shared/src/schemas.ts` là nguồn duy nhất cho rule validate; FE dùng `zodResolver`, BE dùng `ZodPipe`.
- **Schema zod phải khai báo đủ field của GraphQL input**: `ZodPipe` trả về `result.data` và zod **loại bỏ key không khai báo**.
  Thiếu `id` trong `updateUserSchema` từng làm `input.id === undefined` → lỗi Prisma 500 (đúng lỗi "đổi vai trò không hoạt động").
- **Schema phải idempotent**: FE parse dữ liệu form rồi gửi **kết quả đã parse** (`null` cho field để trống) lên BE để parse tiếp,
  nên `parse(parse(x))` phải bằng `parse(x)`. Helper `optionalText`/`optionalUploadPath` dùng `z.preprocess` để nhận
  `''`, `null`, `undefined`. Vi phạm điều này làm **mọi mutation có field tuỳ chọn để trống bị từ chối**.
- **Lỗi nghiệp vụ dùng exception của NestJS** (`BadRequestException`, `ForbiddenException`, `NotFoundException`…),
  không dùng `throw new Error()`: lỗi thường bị trả về dạng 500 và bị Apollo **che mất thông báo**.
- **Số đếm phải bằng số bài thật**: `postCount` của danh mục là tổng **cả cây** (bao gồm danh mục con), tính bằng
  `subtreeCounts()` trong `CategoriesService`. Không hardcode 0 và không quên `include: { _count }` khi lấy danh mục con -
  đây chính là lỗi "mọi danh mục đều 0 bài" đã gặp.
- **Tìm kiếm khớp cả thẻ**: `posts(keyword:)` tìm trong `title`, `summary`, `contentText`, `addressRaw` **và `tags.name`**.
  Nhờ vậy link tag (`/tim-kiem?q=<tên thẻ>`) luôn trả về bài viết chứa thẻ đó. Nếu chỉ tìm trong nội dung, bấm tag sẽ ra rỗng.
- **Tag không nằm trong nội dung**: tag là quan hệ `Post.tags` và được render ở cuối bài từ dữ liệu đó.
  Nội dung HTML cũ có khối `<div><strong>Tags:</strong>...</div>` nên phải bỏ khi import (`stripTagsBlock`/`stripTagsText` trong `@phuochai/shared`)
  để không hiển thị hai lần.
- **Văn phong nội dung**: mọi văn bản dùng gạch nối thường `-`, không dùng gạch dài (em dash/en dash) vì trông "máy móc".
  Seed tự chuẩn hoá khi import; `npm run normalize:dashes -- --apply` xử lý dữ liệu đã có; `npm run verify:content` kiểm tra lại.
- **Địa chỉ dùng chung một nguồn**: `@phuochai/shared` export `WARDS`, `findWard`, `canonicalWardName`, `searchWards`,
  `stripAdministrativeParts`, `formatAddress`. Frontend và backend cùng dùng nên dropdown, validate và hiển thị luôn khớp.
- **Seed phải idempotent theo (tên + nhóm)**, không chỉ theo slug: dataset có các danh mục trùng tên ở nhóm khác nhau,
  nếu nhận diện chỉ bằng slug thì mỗi lần import lại sẽ sinh bản trùng và bài viết bị chuyển sang bản mới.
- **Không dùng `ValidationPipe` toàn cục cho GraphQL**: class-transformer sẽ biến input object thành `{}` trước `ZodPipe`.
- **Không đặt `defaultValue`** trên field optional của input dùng cho cập nhật một phần (GraphQL luôn gửi giá trị mặc định → ghi đè dữ liệu).
- **Editor Tiptap** được cấu hình đủ extension để giữ nguyên cấu trúc nội dung cũ (tiêu đề, danh sách, bảng, ảnh, liên kết);
  cần `immediatelyRender: false` khi dùng với Next.js và **`TooltipProvider`** bọc ngoài (Radix yêu cầu).
- **Bảo mật**: JWT lưu ở `localStorage` cho mục đích demo; production nên chuyển sang httpOnly cookie + refresh token.
- **Logo dùng chung**: component `BrandLogo` (`apps/web/src/components/site/brand-logo.tsx`) render
  `src/assets/logo-mark.png` (128px, tối ưu từ bộ favicon 512px) - dùng ở header, menu mobile, footer,
  sidebar quản trị và trang đăng nhập. Không vẽ lại SVG riêng ở từng nơi.
- **SEO**: `src/app/robots.ts` (chặn `/quan-tri`, `/dang-nhap`, `/tim-kiem`, `/api/`) và
  `src/app/sitemap.ts` (trang tĩnh + danh mục + toàn bộ bài đã xuất bản, `force-dynamic` vì lấy dữ liệu
  từ API lúc chạy - nếu để Next render tĩnh lúc build thì sitemap sẽ rỗng vì build không có API).
  Sitemap cache 10 phút trong bộ nhớ, không cache kết quả rỗng.
- **Xác minh Google Search Console**: file `apps/web/public/googledb548b8b95ead655.html` phục vụ tại
  `https://langchaiphuochai.com/googledb548b8b95ead655.html`. Nội dung file phải giữ **nguyên văn**
  (Google so khớp từng byte); đổi domain thì phải tạo lại file trong Search Console.
- **Icon & manifest**: favicon/apple-touch-icon/PWA manifest dùng quy ước App Router
  (`src/app/favicon.ico`, `icon.png`, `apple-icon.png`, `manifest.ts`) nên Next tự chèn `<link>`;
  tên/màu trong manifest lấy từ `BRAND` nên không lệch thương hiệu. Icon 192/512 trong `public/icons/`.
- **Healthcheck**: API có endpoint `GET /health` (dùng cho Docker/Coolify), ngoài ra `{ ping }` trong GraphQL.
- **Ảnh**: API phục vụ `/upload/*` từ `data/upload`; Next.js proxy `/graphql`, `/api/upload`, `/upload/*` về API để tránh CORS.
- `npm run db:local` dùng PostgreSQL nhúng (chỉ cho dev). Production dùng service `db` trong Docker Compose.
