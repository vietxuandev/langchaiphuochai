'use client';

/**
 * Lưu JWT ở localStorage (đơn giản, phù hợp cho bản demo/review).
 * Khi triển khai production nên chuyển sang httpOnly cookie + refresh token.
 *
 * Lưu ý: key đã đổi tên khi rebrand. `migrateLegacyKeys()` tự chuyển token từ key cũ
 * sang key mới để người dùng đang đăng nhập không bị mất phiên sau khi cập nhật.
 */
const TOKEN_KEY = 'langchaiphuochai.accessToken';
const USER_KEY = 'langchaiphuochai.user';

/** Key của bản trước khi đổi thương hiệu - chỉ dùng để di trú một lần. */
const LEGACY_TOKEN_KEY = 'phuochai.accessToken';
const LEGACY_USER_KEY = 'phuochai.user';

/** Chuyển dữ liệu phiên từ key cũ sang key mới (nếu có). */
function migrateLegacyKeys(): void {
  if (typeof window === 'undefined') return;
  try {
    const legacyToken = window.localStorage.getItem(LEGACY_TOKEN_KEY);
    if (legacyToken && !window.localStorage.getItem(TOKEN_KEY)) {
      window.localStorage.setItem(TOKEN_KEY, legacyToken);
    }
    const legacyUser = window.localStorage.getItem(LEGACY_USER_KEY);
    if (legacyUser && !window.localStorage.getItem(USER_KEY)) {
      window.localStorage.setItem(USER_KEY, legacyUser);
    }
    // Dọn key cũ để không còn dấu vết thương hiệu trước
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_USER_KEY);
  } catch {
    // localStorage có thể bị chặn (chế độ riêng tư) - bỏ qua
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  migrateLegacyKeys();
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function getStoredUser<T>(): T | null {
  if (typeof window === 'undefined') return null;
  migrateLegacyKeys();
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setStoredUser<T>(user: T | null): void {
  if (typeof window === 'undefined') return;
  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(USER_KEY);
}

export function clearAuth(): void {
  setToken(null);
  setStoredUser(null);
}
