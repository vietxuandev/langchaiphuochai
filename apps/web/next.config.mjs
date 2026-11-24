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

/**
 * Header bảo mật cho mọi trang.
 * CSP chỉ gồm các chỉ thị không ảnh hưởng script/iframe của Google AdSense:
 * chống nhúng trang vào iframe site khác (clickjacking), chèn thẻ <base>, form gửi ra ngoài và plugin.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
];

const nextConfig = {
  reactStrictMode: true,
  ...(standalone ? { output: 'standalone', outputFileTracingRoot: workspaceRoot } : {}),
  poweredByHeader: false,
  // Không khai báo remotePatterns: next/image chỉ dùng cho ảnh trong repo. Trước đây
  // `https://**` biến /_next/image thành proxy resize ảnh cho mọi URL trên internet.
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
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
      { source: '/api/media', destination: `${apiInternalUrl}/api/media` },
      { source: '/api/affiliate/:path*', destination: `${apiInternalUrl}/api/affiliate/:path*` },
      { source: '/go/:slug', destination: `${apiInternalUrl}/go/:slug` },
      { source: '/upload/:path*', destination: `${apiInternalUrl}/upload/:path*` },
    ];
  },
  /** Chuyển các URL trùng về URL chuẩn, tránh phân tách tín hiệu SEO. */
  async redirects() {
    return [{ source: '/trang/gioi-thieu', destination: '/gioi-thieu', permanent: true }];
  },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
