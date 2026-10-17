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
# Prisma client phải được generate TRƯỚC khi build: lúc `npm ci`, schema.prisma chưa có
# trong image nên postinstall của @prisma/client không sinh types -> build sẽ lỗi TS2305.
RUN npx prisma generate --schema apps/api/prisma/schema.prisma \
 && npm run build:shared \
 && npm run build -w @phuochai/api

# ---------- Runtime stage ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Prisma cần openssl trên alpine
RUN apk add --no-cache openssl

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api ./apps/api

# Thư mục ảnh upload (mount volume vào đây khi chạy)
RUN mkdir -p /app/data/upload

EXPOSE 4000

# Dùng $PORT để đổi cổng bằng biến môi trường (không cần sửa Dockerfile)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/health" > /dev/null 2>&1 || exit 1

# Migration được chạy trong docker-compose (prisma migrate deploy) trước khi start
CMD ["node", "apps/api/dist/src/main.js"]
