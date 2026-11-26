# =============================================================================
# Image production cho API (NestJS + Prisma) trong monorepo
#
#  - builder: cài đủ dependency (kể cả dev) để build package dùng chung + API
#  - deps   : CHỈ dependency production của API (+ @phuochai/shared) - không kèm
#             devDependencies (Nest CLI, TypeScript, embedded-postgres...) và toàn bộ
#             dependency của web (Next, React, Tiptap...) như bản cũ (~1,65GB)
#  - runner : chạy app bằng user `node`; entrypoint chỉ dùng root để sửa quyền /app/data
#
# Script một lần chạy bằng file đã build (không cần tsx):
#   node apps/api/dist/prisma/seed.js
#   node apps/api/dist/scripts/sanitize-post-html.js [--apply]
#   node apps/api/dist/scripts/normalize-toc.js [--apply]
# =============================================================================

# ---------- Build stage ----------
FROM node:22-alpine AS builder
WORKDIR /app

# Cài dependencies cho toàn bộ workspace (cần cho cả shared + api)
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --include=dev

# Build package dùng chung rồi build API
COPY packages/shared packages/shared
COPY apps/api apps/api
# Chặn sớm nếu thiếu migration Prisma (cần cho `prisma migrate deploy` khi container start)
RUN test -d apps/api/prisma/migrations \
    || (echo "THIEU apps/api/prisma/migrations - kiem tra .gitignore" && exit 1)
# Prisma client phải được generate TRƯỚC khi build: lúc `npm ci`, schema.prisma chưa có
# trong image nên postinstall của @prisma/client không sinh types -> build sẽ lỗi TS2305.
RUN npx prisma generate --schema apps/api/prisma/schema.prisma \
 && npm run build:shared \
 && npm run build -w @phuochai/api

# ---------- Production dependencies ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
# `prisma` (CLI) nằm trong dependencies vì `prisma migrate deploy` chạy lúc container khởi động.
# Package trùng tên khác phiên bản với web (ví dụ sharp) được npm đặt lồng trong
# apps/api/node_modules -> tạo sẵn thư mục để bước COPY ở runner luôn chạy được.
RUN npm ci --omit=dev --workspace=@phuochai/api \
 && npm cache clean --force \
 && mkdir -p apps/api/node_modules packages/shared/node_modules
COPY apps/api/prisma/schema.prisma apps/api/prisma/schema.prisma
RUN npx prisma generate --schema apps/api/prisma/schema.prisma

# ---------- Runtime stage ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Không gửi kiểm tra phiên bản/telemetry của Prisma CLI ra ngoài mỗi lần migrate
ENV CHECKPOINT_DISABLE=1

# Prisma cần openssl trên alpine; su-exec để entrypoint hạ quyền từ root xuống user node
RUN apk add --no-cache openssl su-exec

COPY --from=deps /app/package.json /app/package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/assets ./apps/api/assets
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Code giữ chủ sở hữu root (user node không sửa được) nhưng phải ĐỌC được: file trong build
# context có thể mang quyền 600 (umask của máy build) -> chuẩn hoá về a+rX.
# Thư mục ảnh upload (mount volume vào đây khi chạy) thuộc user node.
RUN chmod -R a+rX /app/package.json /app/package-lock.json \
      /app/packages/shared/package.json /app/packages/shared/dist \
      /app/apps/api/package.json /app/apps/api/dist /app/apps/api/prisma /app/apps/api/assets \
 && chmod +x /usr/local/bin/docker-entrypoint.sh \
 && mkdir -p /app/data/upload \
 && chown -R node:node /app/data

EXPOSE 4000

# Dùng $PORT để đổi cổng bằng biến môi trường (không cần sửa Dockerfile)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/health" > /dev/null 2>&1 || exit 1

# Migration được chạy trong docker-compose (prisma migrate deploy) trước khi start
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "apps/api/dist/src/main.js"]
