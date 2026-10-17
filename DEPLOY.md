# Triển khai lên Coolify

Hướng dẫn từng bước đưa website **Làng Chài Phước Hải** (NestJS API + Next.js + PostgreSQL) lên
Coolify đang chạy trên server riêng của bạn.

> Kiến trúc khi chạy production: **chỉ website ra Internet**. API và database nằm trong mạng nội bộ
> Docker; trình duyệt gọi API qua chính domain website nhờ proxy của Next.js
> (`/graphql`, `/api/upload`, `/upload/*`) nên không cần CORS và không cần subdomain cho API.

```
Internet ──https──> Traefik (Coolify) ──> web (Next.js :3000) ──/graphql,/upload──> api (:4000) ──> db (:5432)
```

---

## 0. Chuẩn bị

| Yêu cầu | Ghi chú |
| --- | --- |
| Server đã cài Coolify | Bạn đã có |
| Tên miền trỏ về IP server | `A` record cho `langchaiphuochai.com` (và `www` nếu dùng) |
| Git repository | Repo hiện **chưa có remote** - xem bước 1 |
| RAM server ≥ 2GB (hoặc có swap) | Build Next.js cần ~2GB; 1GB dễ bị OOM |
| SSH vào server | Để copy dữ liệu ảnh và chạy import |

---

## 1. Đưa mã nguồn lên Git

Coolify deploy từ Git (GitHub/GitLab/Gitea...). Trong thư mục `phuochai-web`:

```bash
git init                      # nếu chưa phải git repo
git add .
git commit -m "Website Làng Chài Phước Hải"

# Tạo repo trống trên GitHub rồi:
git branch -M main
git remote add origin git@github.com:<tài-khoản>/langchai-phuochai.git
git push -u origin main
```

`.gitignore` đã loại `node_modules/`, `data/` (190MB ảnh + dataset), `.env`, `.next`, `dist` -
nên repo chỉ vài MB.

Sau đó trong Coolify: **Settings → Sources → Add** (GitHub App hoặc Deploy Key) để cấp quyền đọc repo.

---

## 2. Chuẩn bị dữ liệu trên server (ảnh + dataset)

Ảnh và dataset **không nằm trong image** mà mount từ thư mục trên host (`DATA_DIR`).

```bash
# Trên server
sudo mkdir -p /data/langchaiphuochai/{upload,seed}

# Từ máy local (thư mục phuochai-web) - copy ảnh và dataset lên server
rsync -avz --progress data/upload/  <user>@<server-ip>:/data/langchaiphuochai/upload/
rsync -avz --progress data/seed/dataset.json <user>@<server-ip>:/data/langchaiphuochai/seed/
```

Kiểm tra trên server:

```bash
ls /data/langchaiphuochai/upload | head        # thấy accommodation, news, real_estate, category...
du -sh /data/langchaiphuochai/upload           # khoảng 187MB
ls -lh /data/langchaiphuochai/seed/dataset.json
```

> Muốn đổi đường dẫn khác thì sửa biến `DATA_DIR` ở bước 3 cho khớp.

---

## 3. Tạo resource trong Coolify

1. Vào **Project → Environment (production) → + New Resource**
2. Chọn **Docker Compose** (hoặc "Docker Compose Empty" rồi trỏ tới repo)
3. Điền:
   - **Repository**: repo vừa push
   - **Branch**: `main`
   - **Base Directory**: `/`
   - **Docker Compose Location**: `/docker-compose.coolify.yml`
4. Sang tab **Environment Variables**, dán theo mẫu `.env.coolify.example` và đổi giá trị:

| Biến | Bắt buộc | Ví dụ | Ý nghĩa |
| --- | --- | --- | --- |
| `JWT_SECRET` | ✅ | `openssl rand -hex 32` | Khoá ký JWT. **Đổi thành chuỗi ngẫu nhiên** |
| `DB_PASSWORD` | ✅ | `mat-khau-manh` | Mật khẩu PostgreSQL (tự đặt) |
| `DB_USER` / `DB_NAME` | | `phuochai` | Giữ mặc định nếu không cần đổi |
| `NEXT_PUBLIC_SITE_URL` | ✅ | `https://langchaiphuochai.com` | Domain công khai (dùng cho canonical, chia sẻ, build web) |
| `CORS_ORIGINS` | ✅ | `https://langchaiphuochai.com` | Domain được phép gọi API |
| `DATA_DIR` | ✅ | `/data/langchaiphuochai` | Thư mục dữ liệu trên host (bước 2) |
| `JWT_EXPIRES_IN` | | `7d` | Thời hạn token |

> `JWT_SECRET` và `DB_PASSWORD` dùng cú pháp `${VAR:?...}` nên nếu thiếu, Coolify sẽ báo lỗi ngay
> thay vì chạy với giá trị mặc định không an toàn.

---

## 4. Gán domain (chỉ cần cho `web`)

Trong resource vừa tạo, mở service **`web`**:

- **Domains**: `https://langchaiphuochai.com` (thêm `https://www.langchaiphuochai.com` nếu muốn)
- **Ports Exposes**: `3000` (Coolify tự đọc từ compose)

Coolify (Traefik) tự xin chứng chỉ Let's Encrypt và route HTTPS vào container `web`.
**Không** gán domain cho `api` và `db` - chúng chỉ chạy trong mạng nội bộ.

Nếu muốn tách API ra subdomain (không khuyến nghị, cần thêm CORS):

- service `api`: domain `https://api.langchaiphuochai.com`, port `4000`
- `NEXT_PUBLIC_GRAPHQL_URL=https://api.langchaiphuochai.com/graphql`
- `CORS_ORIGINS=https://langchaiphuochai.com`

---

## 5. Deploy

Bấm **Deploy**. Lần đầu build khoảng 5-10 phút (2 image: api + web).

Thứ tự khởi động:

1. `db` lên, healthcheck `pg_isready` đạt
2. `api` chạy `npx prisma migrate deploy` (tạo/ cập nhật bảng) rồi start, healthcheck `GET /health`
3. `web` start (đã build sẵn, không cần DB lúc build)

Theo dõi ở tab **Logs** của từng service. Khi cả `web` và `api` hiện **Running/Healthy** là xong.

---

## 6. Import dữ liệu (chạy 1 lần)

Sau khi deploy lần đầu, database còn trống. Có 2 cách:

**Cách A - qua Terminal của Coolify (dễ nhất)**

1. Mở service **`api`** → tab **Terminal** (hoặc "Execute Command")
2. Chạy:

```bash
DATASET_PATH=/app/data/seed/dataset.json UPLOAD_DIR=/app/data/upload npx tsx apps/api/prisma/seed.ts
```

**Cách B - SSH vào server, dùng service `seed` trong compose**

```bash
cd /data/coolify/services/<uuid-của-resource>     # xem đường dẫn trong Coolify → resource → General
sudo docker compose -f docker-compose.coolify.yml --profile tools run --rm seed
```

Kết quả mong đợi (log cuối):

```
Bài trong DB   │ 406
Ảnh trong DB   │ 587
Tag trong DB   │ 987
✅ Import hoàn tất.
```

Script **idempotent**: chạy lại không tạo bản trùng (đã có test `npm run verify:seed`).

---

## 7. Kiểm tra sau khi deploy

```bash
# 1) Website trả 200 và có bài viết
curl -sI https://langchaiphuochai.com | head -1
curl -s https://langchaiphuochai.com | grep -c "hover:-translate-y-1"   # > 0

# 2) API sống (qua proxy của web)
curl -s -X POST https://langchaiphuochai.com/graphql \
  -H 'Content-Type: application/json' -d '{"query":"{ping}"}'

# 3) Ảnh phục vụ đúng
curl -sI https://langchaiphuochai.com/upload/category/homestay-37.jpg | head -1
```

Checklist thủ công:

- [ ] Trang chủ hiển thị bài viết và ảnh (không phải placeholder)
- [ ] `/luu-tru`, `/tin-tuc`, `/bat-dong-san` có dữ liệu, bộ lọc xã/phường hoạt động
- [ ] `/danh-muc/noi-luu-tru` hiện số bài đúng (Homestay 23, Villa 63...)
- [ ] Bấm một tag trong bài viết → thấy bài viết đó trong kết quả
- [ ] `/dang-nhap` → đăng nhập `admin@langchaiphuochai.com` / `Admin@123`
- [ ] `/quan-tri` mở được dashboard
- [ ] Tài khoản → đổi ảnh đại diện → **Lưu** → reload vẫn thấy ảnh (chứng tỏ volume ghi được)
- [ ] Tạo/sửa bài viết, upload ảnh trong editor hoạt động

> **Đổi mật khẩu 3 tài khoản seed ngay sau khi kiểm tra** (Tài khoản → Đổi mật khẩu).

---

## 8. Cập nhật phiên bản sau này

```bash
git add . && git commit -m "..." && git push
```

Vào Coolify → resource → **Deploy**. Migration mới tự chạy khi `api` khởi động lại.
Riêng thay đổi về **biến build** (`NEXT_PUBLIC_*`) thì cần bấm deploy lại (image web phải build lại).

---

## 9. Sao lưu

```bash
# Database
sudo docker exec $(sudo docker ps -qf "name=db") \
  pg_dump -U phuochai phuochai | gzip > /backup/db-$(date +%F).sql.gz

# Ảnh upload
sudo rsync -a /data/langchaiphuochai/upload/ /backup/upload-$(date +%F)/
```

Nên đặt cron hằng ngày và copy ra ngoài server. **`data/upload` là dữ liệu người dùng tải lên -
mất thư mục này là mất toàn bộ ảnh.**

---

## 10. Xử lý sự cố

| Hiện tượng | Nguyên nhân thường gặp / cách xử lý |
| --- | --- |
| **502 Bad Gateway** | `web` chưa healthy. Xem log `web`; kiểm tra `api` đã chạy chưa (`GET /health` trong container). |
| Trang mở được nhưng **không có bài viết** | Chưa chạy import (bước 6) hoặc `DATABASE_URL` trỏ sai DB. |
| **Ảnh 404** | Chưa rsync `data/upload` lên server, hoặc `DATA_DIR` không khớp đường dẫn thật. Kiểm tra: `ls $DATA_DIR/upload`. |
| Ảnh mới upload **mất sau khi deploy lại** | Volume `DATA_DIR` không đúng (ảnh đang ghi trong container). Kiểm tra `docker inspect` thấy mount `/app/data`. |
| Lỗi `JWT_SECRET ... required` | Chưa đặt `JWT_SECRET` trong Environment Variables. |
| `prisma migrate deploy` lỗi | DB chưa healthy hoặc `DB_PASSWORD` có ký tự đặc biệt chưa URL-encode. |
| Build web **OOM / killed** | Server thiếu RAM: thêm swap 2GB hoặc build trên máy khác rồi push image. |
| Đổi domain nhưng vẫn trỏ domain cũ | `NEXT_PUBLIC_SITE_URL` là **biến build** - sửa env rồi **Deploy lại** (không chỉ restart). |
| `Cannot find module '@phuochai/shared'` | Build sai context: **Base Directory** phải là `/` (repo root) và compose file `docker-compose.coolify.yml`. |

Xem log nhanh trên server:

```bash
sudo docker ps                                                # tên container
sudo docker logs -f --tail=100 <tên-container-api>
sudo docker logs -f --tail=100 <tên-container-web>
```

---

## 11. Đã kiểm chứng thực tế

Cấu hình trong repo đã được **build và chạy thử toàn bộ stack bằng Docker Desktop** (macOS):

| Hạng mục | Kết quả |
| --- | --- |
| Build image `api` + `web` | ✅ thành công (`docker compose build`) |
| Rewrites trong image web | ✅ trỏ `http://api:4000` (nhúng lúc build nhờ `build.args`) |
| `NEXT_PUBLIC_SITE_URL` | ✅ có trong JS bundle của image |
| Stack chạy `db` + `api` + `web` | ✅ cả 3 healthcheck đạt |
| Migration tự động khi start | ✅ bảng được tạo, seed chạy được |
| Seed trong container | ✅ 406 bài, 587 ảnh, 986 tag |
| Trang công khai (7 route) | ✅ HTTP 200, có dữ liệu |
| Proxy `/graphql` | ✅ `publicStats.totalPosts = 406`, đăng nhập admin OK |
| Proxy `/upload/...` | ✅ `image/jpeg` 60KB |
| Upload ảnh mới | ✅ ghi đúng vào thư mục host của volume |

Hai lỗi đã phát hiện và sửa nhờ chạy thử:

1. **`@prisma/client` chưa generate** trong image → build API lỗi 59 lỗi TS2305.
   Đã thêm `npx prisma generate` trước khi build trong `apps/api/Dockerfile`.
2. **File trong image thuộc root với quyền 600** → container web crash `EACCES: package.json`.
   Đã dùng `COPY --chown=nextjs:nodejs` trong `apps/web/Dockerfile`.

### Kích thước image

| Image | Trước | Sau khi bật `standalone` |
| --- | --- | --- |
| `web` | 1.81 GB | **354 MB** (phần app chỉ 91 MB, còn lại là base `node:22-alpine`) |
| `api` | 1.6 GB | 1.6 GB (giữ `prisma` CLI + `tsx` để migrate/seed) |

Cách hoạt động: `NEXT_STANDALONE=1` bật `output: 'standalone'` trong `next.config.mjs`; Next trace đúng
file được import khi chạy nên `node_modules` chỉ còn ~85 MB (56 package) thay vì ~1 GB của cả monorepo.

Lưu ý khi bảo trì image web:

- `.next/static` **không** nằm trong standalone -> `Dockerfile` phải `COPY` riêng (thiếu là trắng trang).
- `server.js` bind theo `HOSTNAME` -> phải đặt `HOSTNAME=0.0.0.0`, nếu không proxy không vào được.
- Cần `outputFileTracingRoot` trong `next.config.mjs` để trace `@phuochai/shared` của monorepo.
- Runtime chạy `node apps/web/server.js` (không dùng `next start`).
- Repo không có thư mục `public/`; nếu thêm sau này thì phải `COPY` thêm vào image.

Muốn giảm tiếp `api`: tách bước migration/seed ra image riêng, hoặc prune devDependencies ở stage runtime
(nhưng khi đó mất `prisma` CLI và `tsx` trong container).

---

## 12. Đổi cổng (port)

Có **3 lớp cổng** khác nhau, sửa đúng lớp mới không bị 502:

| Lớp | Là gì | Sửa ở đâu |
| --- | --- | --- |
| **A. Cổng app lắng nghe trong container** | `next server.js` nghe `$PORT` (mặc định 3000), API nghe `$PORT` (mặc định 4000) | **Compose**: biến `WEB_PORT` / `API_PORT` (hoặc `environment.PORT`). Dockerfile chỉ là mặc định |
| **B. Cổng Coolify/Traefik trỏ vào container** | Traefik kết nối tới container qua cổng ở `expose` | **UI Coolify**: service `web` → **Ports Exposes** (và port trong Domain nếu có). Phải khớp lớp A |
| **C. Cổng người dùng gõ trên trình duyệt** | Thực tế là 443/80 của Traefik | Không cần sửa gì; Coolify lo TLS. Muốn cổng lạ (vd 8080) thì cấu hình ở Traefik của server |

### Trường hợp thường gặp: chỉ muốn web chạy cổng khác 3000

**Cách 1 - không sửa code (khuyến nghị)**: giữ nguyên 3000 bên trong, chỉ đổi domain trong Coolify UI.
Người dùng vẫn vào bằng `https://langchaiphuochai.com` (443). Không cần build lại gì.

**Cách 2 - đổi cổng app thật sự** (ví dụ 8080), chỉ cần biến môi trường:

1. Trong Coolify → Environment Variables, thêm:
   ```
   WEB_PORT=8080
   ```
2. Vào service `web` → **Ports Exposes** = `8080` (và cập nhật port trong Domain nếu đang ghi `3000`)
3. Bấm **Deploy** (compose render lại `expose`, container listen 8080)

Đã kiểm chứng: đổi `WEB_PORT=8080` + `API_PORT=4100` chỉ bằng env → web LISTEN `0.0.0.0:8080`,
API LISTEN `0.0.0.0:4100`, healthcheck đạt, trang và proxy vẫn hoạt động.

### Lưu ý quan trọng khi đổi `API_PORT`

`API_INTERNAL_URL` được **nhúng vào bản build** của Next (rewrites). Compose đã tự suy ra
`http://api:${API_PORT:-4000}`, nhưng vì là biến build nên **phải Deploy lại (build lại image web)**.
Nếu chỉ `restart`, web vẫn gọi cổng cũ → trang trắng / `Internal Server Error` / ảnh 404.

Nếu không có nhu cầu đặc biệt: **để API ở 4000** (mạng nội bộ Docker, không ai thấy) và chỉ đổi cổng web.

### Coolify UI có ô đặt cổng cho service compose không?

**Với resource kiểu Docker Compose: Coolify KHÔNG có ô "cổng app lắng nghe".** Cơ chế thật sự:

1. Coolify đọc file compose, lấy cổng service khai báo ở `expose` (hoặc `ports`).
2. Coolify sinh label Traefik `traefik.http.services.<service>.loadbalancer.server.port=<cổng đó>`
   để proxy kết nối vào container.
3. UI của bạn dùng để đặt **domain** (mục *Domains* trong service card, hoặc biến
   `SERVICE_FQDN_WEB` tuỳ phiên bản). Domain không quyết định cổng app nghe.

⇒ Vì vậy **đổi cổng app thì sửa ở compose** (hoặc biến env mà compose dùng). Trong repo này
cổng đã được tham số hoá nên bạn chỉ cần thêm biến, **không phải sửa file**:

```
WEB_PORT=8080     # web
API_PORT=4100     # api (nhớ Deploy lại vì là biến build của web)
```

Sau đó vào service `web` → kiểm tra **Ports Exposes** hiển thị `8080` (Coolify đọc từ compose;
một số phiên bản cho sửa tay ở đây - nếu có thì set cho khớp), rồi **Deploy**.

**Cách xác minh sau khi deploy** (chắc chắn proxy đang trỏ đúng cổng):

```bash
# 1) App nghe cổng nào trong container
docker exec <container-web> sh -c "netstat -tlnp || ss -tlnp"

# 2) Traefik được bảo trỏ vào cổng nào
docker inspect <container-web> --format '{{json .Config.Labels}}' \
  | tr ',' '\n' | grep loadbalancer.server.port

# 3) Hai số này PHẢI giống nhau. Nếu khác -> proxy 502, sửa WEB_PORT/expose trong compose
#    (hoặc ô Ports Exposes trong UI nếu phiên bản có) rồi Deploy lại.
```

### Healthcheck

Healthcheck trong Dockerfile dùng `${PORT:-3000}` / `${PORT:-4000}` nên đổi cổng bằng env
là healthcheck tự theo, không phải sửa Dockerfile.

---

## 13. Ghi chú kỹ thuật về cấu hình Docker

- **`API_INTERNAL_URL` là biến build**: `next.config.mjs` dùng nó cho `rewrites()` và Next nhúng
  vào `.next/routes-manifest.json` lúc build → `docker-compose.coolify.yml` truyền qua `build.args`.
- **`NEXT_PUBLIC_*` cũng là biến build** (nhúng vào JS trình duyệt).
- **Không publish port** (`expose` thay vì `ports`) - Coolify/Traefik route theo domain, tránh xung
  đột cổng và tránh lộ API/DB ra Internet.
- **Healthcheck**: api `GET /health`, web `GET /`, db `pg_isready`.
- **Volume**: `pgdata` (named volume do Docker quản lý) và `DATA_DIR` (thư mục host, dễ backup).
- **Migration tự động**: `api` chạy `prisma migrate deploy` trước khi start - deploy lại nhiều lần
  vẫn an toàn.
- **Ảnh do API phục vụ** tại `/upload/*` và được web proxy - không cần cấu hình Nginx riêng.
