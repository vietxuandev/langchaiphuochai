# =============================================================================
# Image production cho Next.js (monorepo) dùng chế độ `standalone`
#
# Vì sao: `next start` cần TOÀN BỘ node_modules của monorepo (~1GB, gồm cả Prisma,
# NestJS, typescript... của API). `output: 'standalone'` để Next trace đúng những file
# được import khi chạy -> node_modules chỉ còn ~89MB (56 package).
#
# Lưu ý khi bảo trì:
#  - `.next/static` KHÔNG nằm trong standalone, phải COPY riêng.
#  - `server.js` bind vào HOSTNAME, phải đặt HOSTNAME=0.0.0.0 để Traefik/Coolify vào được.
#  - Cần `outputFileTracingRoot` (đã đặt trong next.config.mjs) để trace @phuochai/shared.
# =============================================================================

# ---------- Build stage ----------
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Next.js nhúng 2 loại biến vào bản build:
#  - NEXT_PUBLIC_*: nhúng vào JS chạy ở trình duyệt  -> phải có lúc BUILD
#  - API_INTERNAL_URL: dùng cho rewrites trong next.config.mjs -> cũng phải có lúc BUILD
ARG API_INTERNAL_URL=http://api:4000
ARG NEXT_PUBLIC_SITE_URL=https://langchaiphuochai.com
ARG NEXT_PUBLIC_GRAPHQL_URL=/graphql
ENV API_INTERNAL_URL=$API_INTERNAL_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_GRAPHQL_URL=$NEXT_PUBLIC_GRAPHQL_URL

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --include=dev

COPY packages/shared packages/shared
COPY apps/web apps/web
# Schema GraphQL để chạy codegen trong lúc build
COPY apps/api/schema.graphql apps/api/schema.graphql

# NEXT_STANDALONE=1 -> bật output: 'standalone' trong next.config.mjs
ENV NEXT_STANDALONE=1
RUN npm run build:shared && npm run codegen -w @phuochai/web && npm run build -w @phuochai/web

# ---------- Runtime stage ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Bắt buộc: server.js của Next mặc định bind localhost -> nếu không đổi, proxy không vào được
ENV HOSTNAME=0.0.0.0
# Giữ lại cho proxy khi chạy (giá trị đã build vào .next)
ENV API_INTERNAL_URL=http://api:4000

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Chỉ copy phần thật sự cần khi chạy (đã trace sẵn trong builder)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
# JS/CSS cho trình duyệt: Next KHÔNG đưa vào standalone
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

# Next có thể ghi cache (ISR/image) -> cần quyền cho user chạy
RUN mkdir -p /app/apps/web/.next/cache && chown -R nextjs:nodejs /app/apps/web/.next

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ > /dev/null 2>&1 || exit 1

# server.js tối giản do Next sinh ra (không dùng `next start`)
CMD ["node", "apps/web/server.js"]
