import { Injectable } from '@nestjs/common';
import { mcpConfig } from './mcp.config';

/**
 * Giới hạn số request theo token (cửa sổ trượt 60 giây).
 *
 * Chạy trong bộ nhớ: đủ cho 1 instance API. Nếu sau này scale nhiều instance,
 * chuyển sang Redis hoặc bảng đếm trong DB (audit log đã có sẵn dữ liệu).
 */
@Injectable()
export class McpRateLimitService {
  private readonly windows = new Map<string, number[]>();
  private lastCleanup = Date.now();

  /** Ghi nhận 1 request; trả về số giây cần chờ nếu vượt hạn mức. */
  hit(tokenId: string): { allowed: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    const windowMs = 60_000;
    const limit = mcpConfig.rateLimitPerMin;
    const hits = (this.windows.get(tokenId) ?? []).filter((time) => now - time < windowMs);

    this.cleanup(now);

    if (hits.length >= limit) {
      const oldest = hits[0] ?? now;
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000)) };
    }

    hits.push(now);
    this.windows.set(tokenId, hits);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  /** Dọn token không còn hoạt động để Map không phình. */
  private cleanup(now: number): void {
    if (now - this.lastCleanup < 60_000) return;
    this.lastCleanup = now;
    for (const [tokenId, hits] of this.windows) {
      const alive = hits.filter((time) => now - time < 60_000);
      if (alive.length === 0) this.windows.delete(tokenId);
      else this.windows.set(tokenId, alive);
    }
  }
}
