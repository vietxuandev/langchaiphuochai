/** @type {import('next').NextConfig} */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';
/**
 * NEXT_STANDALONE=1 -> build ra `.next/standalone` (chỉ gồm file thật sự cần khi chạy).
 * Dùng cho image production; dev/local không bật nên không ảnh hưởng.
 */
const standalone = process.env.NEXT_STANDALONE === '1';
/** Gốc workspace (monorepo) để Next trace cả package dùng chung `@phuochai/shared`. */
const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const nextConfig = {
  reactStrictMode: true,
  ...(standalone ? { output: 'standalone', outputFileTracingRoot: workspaceRoot } : {}),
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  /**
   * Proxy GraphQL, API upload và ảnh về API NestJS.
   * Trình duyệt luôn gọi same-origin (không cần CORS); ảnh phục vụ từ thư mục
   * `upload/` của server mới qua đường dẫn `/upload/...`.
   */
  async rewrites() {
    return [
      { source: '/graphql', destination: `${apiInternalUrl}/graphql` },
      { source: '/api/upload', destination: `${apiInternalUrl}/api/upload` },
      { source: '/upload/:path*', destination: `${apiInternalUrl}/upload/:path*` },
    ];
  },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
