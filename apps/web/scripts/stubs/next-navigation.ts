/**
 * Stub `next/navigation` cho môi trường test ngoài Next.js (happy-dom).
 *
 * Chữ ký hàm giữ tương thích với API thật của Next để code ứng dụng type-check được
 * khi dùng tsconfig.scripts.json. Chỉ dùng trong script kiểm tra, không ảnh hưởng ứng dụng.
 */
type NavigateOptions = { scroll?: boolean };

export function useRouter() {
  return {
    push: (_href: string, _options?: NavigateOptions): void => undefined,
    replace: (_href: string, _options?: NavigateOptions): void => undefined,
    refresh: (): void => undefined,
    back: (): void => undefined,
    forward: (): void => undefined,
    prefetch: (_href: string): void => undefined,
  };
}

export function usePathname(): string {
  return '/quan-tri/tai-khoan';
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams();
}

export function useParams<T = Record<string, string>>(): T {
  return {} as T;
}

export function redirect(_url: string): never {
  throw new Error('redirect() chỉ có ý nghĩa trong ứng dụng thật');
}

export function permanentRedirect(_url: string): never {
  throw new Error('permanentRedirect() chỉ có ý nghĩa trong ứng dụng thật');
}

export function notFound(): never {
  throw new Error('notFound() chỉ có ý nghĩa trong ứng dụng thật');
}
