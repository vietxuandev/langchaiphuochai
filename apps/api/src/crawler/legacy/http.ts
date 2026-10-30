/**
 * HTTP client tối giản để đọc website cũ: timeout, thử lại, giới hạn song song.
 * (Bản gốc dùng lớp HttpClient có state/log của CLI; ở đây rút gọn cho API.)
 */
import { http as httpConfig } from './config';

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  accept?: string;
}

/** Lỗi khi không tải được trang (dùng để báo cho admin biết lý do). */
export class LegacyFetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LegacyFetchError';
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Tải một trang HTML từ site cũ. */
export async function fetchHtml(url: string, options: FetchOptions = {}): Promise<string> {
  const retries = options.retries ?? httpConfig.retries;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? httpConfig.timeoutMs);
      const response = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'user-agent': httpConfig.userAgent,
          accept: options.accept ?? 'text/html,application/xhtml+xml',
          'accept-language': 'vi,en;q=0.8',
        },
      }).finally(() => clearTimeout(timer));

      if (!response.ok) {
        throw new LegacyFetchError(`Trang trả về HTTP ${response.status}`, response.status);
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('html') && !contentType.includes('text')) {
        throw new LegacyFetchError(`Không phải trang HTML (${contentType || 'không rõ'})`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(httpConfig.retryBaseDelayMs * (attempt + 1));
    }
  }

  if (lastError instanceof LegacyFetchError) throw lastError;
  const message = lastError instanceof Error ? lastError.message : 'Lỗi không xác định';
  throw new LegacyFetchError(`Không tải được ${url}: ${message}`);
}

/** Tải một file nhị phân (ảnh) từ site cũ. */
export async function fetchBinary(
  url: string,
  options: FetchOptions = {},
): Promise<{ buffer: Buffer; contentType: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? httpConfig.timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': httpConfig.userAgent, accept: 'image/*,*/*;q=0.8' },
    }).finally(() => clearTimeout(timer));

    if (!response.ok) {
      throw new LegacyFetchError(`Ảnh trả về HTTP ${response.status}`, response.status);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type'),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Chạy song song có giới hạn (giữ nhịp độ, không làm quá tải site cũ). */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
      if (httpConfig.minDelayMs > 0) await sleep(httpConfig.minDelayMs);
    }
  });

  await Promise.all(runners);
  return results;
}
