import { HttpException, HttpStatus } from '@nestjs/common';

/** Số khoá tối đa giữ trong bộ nhớ (chặn phình RAM khi bị gửi IP giả liên tục). */
const MAX_KEYS = 10_000;

/**
 * Giới hạn số lần thao tác theo khoá (cửa sổ trượt), chạy trong bộ nhớ.
 *
 * Đủ cho 1 instance API như hiện tại; nếu scale nhiều instance thì chuyển sang Redis/DB.
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();
  private lastCleanup = Date.now();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Ghi nhận một lần thao tác; `allowed = false` kèm số giây cần chờ nếu vượt hạn mức. */
  hit(key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
    this.cleanup(now);

    const recent = (this.hits.get(key) ?? []).filter((time) => now - time < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      const oldest = recent[0] ?? now;
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((this.windowMs - (now - oldest)) / 1000)),
      };
    }

    recent.push(now);
    this.hits.delete(key);
    this.hits.set(key, recent);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  private cleanup(now: number): void {
    const due = now - this.lastCleanup >= this.windowMs;
    if (!due && this.hits.size <= MAX_KEYS) return;

    this.lastCleanup = now;
    for (const [key, times] of this.hits) {
      const alive = times.filter((time) => now - time < this.windowMs);
      if (alive.length === 0) this.hits.delete(key);
      else this.hits.set(key, alive);
    }
    // Vẫn quá nhiều khoá còn hạn: bỏ khoá cũ nhất (Map giữ thứ tự chèn)
    for (const key of this.hits.keys()) {
      if (this.hits.size <= MAX_KEYS) break;
      this.hits.delete(key);
    }
  }
}

/** Lỗi 429 dạng object để formatError của GraphQL nhận đúng statusCode và message. */
export function tooManyRequests(message: string): HttpException {
  return new HttpException(
    { statusCode: HttpStatus.TOO_MANY_REQUESTS, message, error: 'Too Many Requests' },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
