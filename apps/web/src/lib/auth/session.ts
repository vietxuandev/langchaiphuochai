'use client';

import { clearAuth } from './token';

/** Phát khi token hết hạn/không còn hợp lệ để AuthProvider logout ngay. */
export const SESSION_EXPIRED_EVENT = 'langchaiphuochai:session-expired';

const NOTICE_COOLDOWN_MS = 30_000;
let lastNoticeAt = 0;

/**
 * Chỉ xử lý một lần trong 30 giây:
 * - xoá token/user khỏi localStorage,
 * - phát event để AuthProvider cập nhật UI,
 * - trả về true nếu caller nên hiện toast.
 *
 * Nhờ vậy nhiều query cùng nhận 401 không tạo ra nhiều toast.
 */
export function notifySessionExpired(): boolean {
  if (typeof window === 'undefined') return false;

  const now = Date.now();
  if (now - lastNoticeAt < NOTICE_COOLDOWN_MS) return false;
  lastNoticeAt = now;

  clearAuth();
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  return true;
}

/** Reset sau khi đăng nhập lại để lần hết hạn sau vẫn có thông báo. */
export function resetSessionExpiredNotice(): void {
  lastNoticeAt = 0;
}
