/**
 * Cấu hình MCP server, đọc từ biến môi trường (xem `.env.coolify.example`).
 *
 * Tách riêng để dễ kiểm thử và để controller/tool dùng cùng một nguồn giá trị.
 */
const trimSlash = (value: string): string => value.replace(/\/+$/, '');

const publicUrl = trimSlash(process.env.MCP_PUBLIC_URL ?? 'http://localhost:4000');
const siteUrl = trimSlash(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://langchaiphuochai.com');

/** Host được phép gọi /mcp (chống DNS rebinding). */
function allowedHosts(): string[] {
  const port = process.env.PORT ?? '4000';
  const hosts = new Set<string>([
    'localhost',
    '127.0.0.1',
    `localhost:${port}`,
    `127.0.0.1:${port}`,
    `api:${port}`,
    'api:4000',
  ]);

  try {
    const parsed = new URL(publicUrl);
    hosts.add(parsed.host);
    hosts.add(parsed.hostname);
  } catch {
    // publicUrl không hợp lệ -> chỉ dùng danh sách mặc định
  }

  // Cho phép bổ sung host qua biến môi trường (ví dụ domain qua proxy)
  for (const extra of (process.env.MCP_ALLOWED_HOSTS ?? '').split(',')) {
    const host = extra.trim();
    if (host) hosts.add(host);
  }

  return [...hosts];
}

/** Origin của website được phép gọi (client trình duyệt); CLI/agent không gửi Origin. */
function allowedOrigins(): string[] {
  const origins = new Set<string>([siteUrl, publicUrl]);
  try {
    origins.add(new URL(siteUrl).origin);
    origins.add(new URL(publicUrl).origin);
  } catch {
    // bỏ qua
  }
  return [...origins];
}

export const mcpConfig = {
  /** Bật/tắt toàn bộ MCP server (mặc định bật). */
  enabled: process.env.MCP_ENABLED !== 'false',
  /** URL công khai của MCP server - dùng cho resource metadata và tài liệu. */
  publicUrl,
  /** URL website (để trả về link bài viết cho agent). */
  siteUrl,
  /** Số request tối đa mỗi phút cho một token. */
  rateLimitPerMin: Number.parseInt(process.env.MCP_RATE_LIMIT_PER_MIN ?? '60', 10) || 60,
  /** Số bài tối đa một token được tạo trong một ngày. */
  dailyPostLimit: Number.parseInt(process.env.MCP_DAILY_POST_LIMIT ?? '200', 10) || 200,
  /** Số ảnh tối đa cho một bài (dùng ở Phase 2). */
  maxImagesPerPost: Number.parseInt(process.env.MCP_MAX_IMAGES_PER_POST ?? '20', 10) || 20,
  /** Cho phép token có scope posts:publish xuất bản thật (mặc định tắt). */
  allowPublish: process.env.MCP_ALLOW_PUBLISH === 'true',
  /** Chuỗi bí mật thêm vào khi hash token (khuyến nghị đặt trên production). */
  tokenPepper: process.env.MCP_TOKEN_PEPPER ?? '',
  /** Host/Origin được phép. */
  hosts: allowedHosts(),
  origins: allowedOrigins(),
  /** Đường dẫn metadata theo RFC 9728. */
  get resourceMetadataUrl(): string {
    return `${this.publicUrl}/.well-known/oauth-protected-resource`;
  },
} as const;
