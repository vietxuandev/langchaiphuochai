/**
 * Test tích hợp cho luồng ảnh đại diện (chạy với API + web thật đang chạy).
 *
 * Kiểm tra 3 kịch bản thường gây lỗi "reload xong mất ảnh đại diện":
 *   1. Di trú token từ key localStorage của bản cũ (đổi thương hiệu) - không bị mất phiên.
 *   2. Reload trang: `useAuth()` khôi phục đúng avatar từ DB.
 *   3. Lưu hồ sơ từ form thật: avatar được ghi đúng vào database (không bị ghi đè/null).
 *
 * Chạy: npm run verify:avatar -w @phuochai/web   (cần `npm run dev:api` và web đang chạy)
 */
import { Window } from 'happy-dom';

const ORIGIN = process.env.TEST_ORIGIN ?? 'http://localhost:3000';

const window = new Window({ url: ORIGIN, height: 900, width: 1400 });

function setGlobal(key: string, value: unknown): void {
  try {
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  } catch {
    /* bỏ qua */
  }
}

setGlobal('window', window);
setGlobal('document', window.document);
setGlobal('navigator', window.navigator);
setGlobal('location', window.location);
setGlobal('HTMLElement', window.HTMLElement);
setGlobal('Element', window.Element);
setGlobal('Node', window.Node);
setGlobal('DOMParser', window.DOMParser);
setGlobal('MutationObserver', window.MutationObserver);
setGlobal('getComputedStyle', window.getComputedStyle.bind(window));
setGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number =>
  setTimeout(() => callback(Date.now()), 16) as unknown as number);
setGlobal('cancelAnimationFrame', (handle: number): void => clearTimeout(handle));
setGlobal('self', window);
setGlobal('localStorage', window.localStorage);
setGlobal('sessionStorage', window.sessionStorage);
setGlobal(
  'matchMedia',
  window.matchMedia?.bind(window) ??
    (() => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
    })),
);

// fetch của Node không hiểu URL tương đối của trình duyệt → thêm origin
const nodeFetch = globalThis.fetch;
setGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' && input.startsWith('/') ? `${ORIGIN}${input}` : input;
  return nodeFetch(url as RequestInfo, init);
});

interface GqlResult<T> {
  data?: T;
  errors?: { message: string }[];
}

async function gql<T>(query: string, variables?: Record<string, unknown>, token?: string): Promise<GqlResult<T>> {
  const response = await nodeFetch(`${ORIGIN}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  return (await response.json()) as GqlResult<T>;
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Tạo một ảnh PNG thật (không nén phức tạp) để test upload. */
function makePng(width: number, height: number, rgb: [number, number, number]): Uint8Array {
  const crcTable: number[] = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  const crc32 = (buffer: Uint8Array): number => {
    let crc = 0xffffffff;
    for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Uint8Array): Uint8Array => {
    const typeBytes = new TextEncoder().encode(type);
    const body = new Uint8Array([...typeBytes, ...data]);
    const out = new Uint8Array(8 + data.length + 4);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    out.set(body, 4);
    view.setUint32(4 + body.length, crc32(body));
    return out;
  };

  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 2;

  const raw = new Uint8Array(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const offset = y * (1 + width * 3);
    raw[offset] = 0;
    for (let x = 0; x < width; x += 1) {
      raw[offset + 1 + x * 3] = rgb[0];
      raw[offset + 2 + x * 3] = rgb[1];
      raw[offset + 3 + x * 3] = rgb[2];
    }
  }

  // Nén bằng zlib "stored" (không nén) để không phụ thuộc thư viện
  const stored = (data: Uint8Array): Uint8Array => {
    const blocks: number[] = [0x78, 0x01];
    for (let i = 0; i < data.length; i += 65535) {
      const slice = data.subarray(i, Math.min(i + 65535, data.length));
      const last = i + 65535 >= data.length ? 1 : 0;
      blocks.push(last, slice.length & 0xff, (slice.length >> 8) & 0xff, ~slice.length & 0xff, (~slice.length >> 8) & 0xff);
      blocks.push(...slice);
    }
    let a = 1;
    let b = 0;
    for (const byte of data) {
      a = (a + byte) % 65521;
      b = (b + a) % 65521;
    }
    blocks.push((b >> 8) & 0xff, b & 0xff, (a >> 8) & 0xff, a & 0xff);
    return new Uint8Array(blocks);
  };

  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new Uint8Array([
    ...signature,
    ...chunk('IHDR', ihdr),
    ...chunk('IDAT', stored(raw)),
    ...chunk('IEND', new Uint8Array()),
  ]);
}

async function main(): Promise<void> {
  const failures: string[] = [];

  /* -------------------- 0. Đăng nhập thật để có token -------------------- */
  const login = await gql<{ login: { accessToken: string; user: { avatarUrl: string | null; name: string } } }>(
    `mutation { login(input: { email: "${process.env.VERIFY_ADMIN_EMAIL ?? 'admin@langchaiphuochai.com'}", password: "${process.env.VERIFY_ADMIN_PASSWORD ?? 'Admin@123'}" }) { accessToken user { name avatarUrl } } }`,
  );
  const token = login.data?.login.accessToken;
  const dbAvatar = login.data?.login.user.avatarUrl ?? '';
  if (!token) {
    console.log('❌ Không đăng nhập được - hãy chắc chắn API đang chạy.');
    process.exit(1);
  }
  console.log(`Avatar trong DB: ${dbAvatar || '(chưa đặt)'}`);

  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { Providers } = await import('@/app/providers');
  const { useAuth } = await import('@/lib/auth/auth-context');
  const { AdminShell } = await import('@/components/admin/admin-shell');
  const { AccountSettings } = await import('@/components/admin/account-settings');
  const { getToken } = await import('@/lib/auth/token');

  const originalError = console.error;
  console.error = (...args: unknown[]): void => {
    const text = args.map(String).join(' ');
    if (!/not wrapped in act/i.test(text)) failures.push(`console.error: ${text.slice(0, 160)}`);
    originalError(...args);
  };

  /* ---------------- 1. Di trú token từ key của bản cũ ------------------- */
  window.localStorage.clear();
  window.localStorage.setItem('phuochai.accessToken', token);
  const migrated = getToken();
  console.log('');
  console.log(`1) Di trú token từ key cũ : ${migrated === token ? 'OK' : 'THẤT BẠI'}`);
  if (migrated !== token) failures.push('Token không được di trú từ key localStorage cũ');
  if (window.localStorage.getItem('phuochai.accessToken')) {
    failures.push('Key localStorage cũ chưa được dọn');
  }

  /* ------------------- 2. Reload: useAuth có avatar? -------------------- */
  function Probe() {
    const { user, loading } = useAuth();
    return React.createElement(
      'div',
      null,
      React.createElement('span', { id: 'state' }, loading ? 'loading' : user ? 'ready' : 'guest'),
      React.createElement('span', { id: 'avatar' }, user?.avatarUrl ?? 'none'),
    );
  }

  const probeContainer = window.document.createElement('div');
  window.document.body.appendChild(probeContainer);
  createRoot(probeContainer as unknown as HTMLElement).render(
    React.createElement(Providers, null, React.createElement(Probe)),
  );
  await wait(2500);

  const state = probeContainer.querySelector('#state')?.textContent ?? '';
  const clientAvatar = probeContainer.querySelector('#avatar')?.textContent ?? '';
  console.log(`2) Sau reload - phiên: ${state} | avatar: ${clientAvatar || '(trống)'}`);
  if (state !== 'ready') failures.push('Sau reload không khôi phục được phiên đăng nhập');
  if (clientAvatar !== (dbAvatar || 'none')) {
    failures.push(`Avatar sau reload không khớp DB (client=${clientAvatar}, db=${dbAvatar})`);
  }

  /* ------------- 3. Đổi sang ẢNH MỚI từ form thật → ghi vào DB ------------- */
  // Quan trọng: phải đổi sang giá trị KHÁC giá trị cũ, nếu không test sẽ "pass giả"
  // dù mutation thất bại (đây chính là lỗi đã xảy ra trước đây).
  const png = makePng(48, 48, [200, 60, 60]);
  const uploadForm = new FormData();
  uploadForm.append('file', new Blob([png], { type: 'image/png' }), 'anh-doi-avatar.png');
  const uploadResponse = await nodeFetch(`${ORIGIN}/api/upload?folder=avatars`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: uploadForm,
  });
  const uploaded = (await uploadResponse.json()) as { path?: string; message?: string };
  if (!uploaded.path) {
    console.log(`❌ Không upload được ảnh test: ${uploaded.message ?? uploadResponse.status}`);
    process.exit(1);
  }
  console.log(`3) Ảnh mới upload: ${uploaded.path}`);

  const formContainer = window.document.createElement('div');
  window.document.body.appendChild(formContainer);
  createRoot(formContainer as unknown as HTMLElement).render(
    React.createElement(
      Providers,
      null,
      React.createElement(AdminShell, null, React.createElement(AccountSettings)),
    ),
  );
  await wait(2500);

  const manualButton = [...formContainer.querySelectorAll('button')].find((button) =>
    (button.textContent ?? '').includes('Nhập đường dẫn thủ công'),
  ) as HTMLButtonElement | undefined;
  manualButton?.click();
  await wait(300);

  const inputs = [...formContainer.querySelectorAll('input')] as HTMLInputElement[];
  const pathInput = inputs.find((input) => (input.placeholder ?? '').includes('/upload/avatars/'));

  if (!manualButton || !pathInput) {
    failures.push('Không tìm thấy ô nhập đường dẫn ảnh trong form hồ sơ');
  } else {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(pathInput, uploaded.path);
    pathInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    await wait(200);

    const saveButton = [...formContainer.querySelectorAll('button')].find((button) =>
      (button.textContent ?? '').includes('Lưu hồ sơ'),
    ) as HTMLButtonElement | undefined;
    saveButton?.click();
    await wait(2500);

    const after = await gql<{ me: { avatarUrl: string | null } }>('{ me { avatarUrl } }', undefined, token);
    const saved = after.data?.me.avatarUrl ?? '';
    console.log(`   Avatar trong DB sau khi lưu: ${saved || '(trống)'}`);

    if (saved !== uploaded.path) {
      failures.push(
        `Đổi avatar thất bại: DB vẫn là "${dbAvatar || 'trống'}", mong đợi "${uploaded.path}"`,
      );
    }

    // Khôi phục trạng thái ban đầu: trả avatar cũ và xoá ảnh test
    await gql(
      'mutation($input: UpdateProfileInput!) { updateProfile(input: $input) { id } }',
      { input: { name: login.data?.login.user.name ?? 'Quản trị viên', avatarUrl: dbAvatar || null } },
      token,
    );
    await nodeFetch(`${ORIGIN}/api/upload?path=${encodeURIComponent(uploaded.path)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('   Đã khôi phục avatar ban đầu và xoá ảnh test.');
  }

  console.log('');
  if (failures.length > 0) {
    failures.forEach((failure) => console.log(`❌ ${failure}`));
    process.exit(1);
  }
  console.log('✅ Ảnh đại diện: di trú phiên, khôi phục sau reload và lưu hồ sơ đều hoạt động đúng.');
  process.exit(0);
}

main().catch((error) => {
  console.error('Lỗi test:', error);
  process.exit(1);
});
