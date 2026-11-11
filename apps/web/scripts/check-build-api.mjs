/**
 * Kiểm tra API trước khi build static/ISR.
 *
 * Nếu API_BUILD_URL được đặt mà API không trả lời, dừng build thay vì
 * cache các trang rỗng vào HTML.
 */
const baseUrl = process.env.API_BUILD_URL?.trim();

if (!baseUrl) {
  console.log('[build] API_BUILD_URL trống - bỏ qua kiểm tra API build.');
  process.exit(0);
}

const endpoint = `${baseUrl.replace(/\/+$/, '')}/graphql`;

try {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ ping }' }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload?.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join('; '));
  }

  console.log(`[build] API build OK: ${endpoint}`);
} catch (error) {
  console.error(`[build] Không truy cập được API build tại ${endpoint}:`, error.message);
  process.exit(1);
}
