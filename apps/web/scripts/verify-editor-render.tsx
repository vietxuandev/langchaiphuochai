/**
 * Test mount thật (không cần trình duyệt) cho editor trực quan.
 *
 * Mục đích: bắt các lỗi chỉ xuất hiện khi chạy trong trình duyệt - ví dụ
 * `Tooltip must be used within TooltipProvider` (Radix yêu cầu provider bọc ngoài).
 *
 * Cách làm: dựng DOM bằng happy-dom → render đúng cây provider của ứng dụng
 * (`<Providers>`) + `<RichTextEditor>` → kiểm tra không có lỗi console và thanh công cụ render đủ nút.
 *
 * Chạy: npm run verify:editor:render -w @phuochai/web
 */
import { Window } from 'happy-dom';

/* ------------------------- 1. Dựng môi trường DOM ------------------------- */
const window = new Window({ url: 'http://localhost:3000', height: 900, width: 1400 });

/**
 * Gán biến toàn cục cho môi trường test.
 * Dùng defineProperty vì một số thuộc tính (navigator, location) chỉ có getter trong Node.
 */
function setGlobal(key: string, value: unknown): void {
  try {
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  } catch {
    // Bỏ qua nếu môi trường không cho ghi đè (không ảnh hưởng phần còn lại của test)
  }
}

setGlobal('window', window);
setGlobal('document', window.document);
setGlobal('navigator', window.navigator);
setGlobal('location', window.location);
setGlobal('HTMLElement', window.HTMLElement);
setGlobal('HTMLInputElement', window.HTMLInputElement);
setGlobal('Element', window.Element);
setGlobal('Node', window.Node);
setGlobal('DOMParser', window.DOMParser);
setGlobal('MutationObserver', window.MutationObserver);
setGlobal('getComputedStyle', window.getComputedStyle.bind(window));
setGlobal('requestAnimationFrame', (callback: FrameRequestCallback): number =>
  setTimeout(() => callback(Date.now()), 16) as unknown as number);
setGlobal('cancelAnimationFrame', (handle: number): void => clearTimeout(handle));
setGlobal('IS_REACT_ACT_ENVIRONMENT', true);

/* --------------------- 2. Thu thập lỗi console/React ---------------------- */
const problems: string[] = [];
const originalError = console.error;
const originalWarn = console.warn;

console.error = (...args: unknown[]): void => {
  const text = args.map((value) => String(value)).join(' ');
  // Bỏ qua cảnh báo act(...) của React - không liên quan tới lỗi hiển thị
  if (!/not wrapped in act/i.test(text)) problems.push(`console.error: ${text}`);
  originalError(...args);
};
console.warn = (...args: unknown[]): void => {
  const text = args.map((value) => String(value)).join(' ');
  // Cảnh báo về Radix aria/description không phải lỗi chặn hiển thị
  if (/must be used within|not wrapped|Missing/i.test(text)) problems.push(`console.warn: ${text}`);
  originalWarn(...args);
};

/* ------------------------ 3. Render cây provider thật --------------------- */
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const React = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { Providers } = await import('@/app/providers');
  const { RichTextEditor } = await import('@/components/ui/rich-text-editor');
  const { ImageUploadField } = await import('@/components/ui/image-upload-field');
  const { WardCombobox } = await import('@/components/ui/ward-combobox');

  const container = window.document.createElement('div');
  window.document.body.appendChild(container);

  const content = '<h2>Tiêu đề mẫu</h2><p>Nội dung <strong>đậm</strong> và <a href="/luu-tru">liên kết</a>.</p><ul><li>Mục 1</li></ul>';
  // happy-dom trả về kiểu DOM riêng - ép kiểu để dùng với react-dom/client
  const root = createRoot(container as unknown as HTMLElement);

  root.render(
    React.createElement(
      Providers,
      null,
      React.createElement(RichTextEditor, {
        value: content,
        onChange: () => undefined,
      }),
    ),
  );

  // Chờ effect của Tiptap chạy xong (tạo editor + render thanh công cụ)
  await wait(600);

  /* ----------------------------- 4. Kiểm tra ----------------------------- */
  const buttons = container.querySelectorAll('button[aria-label]');
  const editorSurface = container.querySelector('.tiptap, [contenteditable="true"]');

  const failures: string[] = [];

  const tooltipError = problems.find((message) => /TooltipProvider|must be used within/i.test(message));
  if (tooltipError) failures.push(`Lỗi provider Radix: ${tooltipError}`);
  if (buttons.length < 15) failures.push(`Thanh công cụ chỉ render ${buttons.length} nút (yêu cầu ≥ 15)`);

  const labels = [...buttons].map((button) => button.getAttribute('aria-label') ?? '');
  for (const required of ['In đậm (Ctrl+B)', 'Danh sách dấu đầu dòng', 'Chèn ảnh từ máy tính', 'Bảng biểu']) {
    if (!labels.some((label) => label.includes(required))) {
      failures.push(`Thiếu nút "${required}" trên thanh công cụ`);
    }
  }

  console.log(`Số nút trên thanh công cụ : ${buttons.length}`);
  console.log(`Vùng soạn thảo (contenteditable): ${editorSurface ? 'có' : 'KHÔNG'}`);
  console.log(`Lỗi console ghi nhận      : ${problems.length}`);

  if (failures.length > 0) {
    console.log('');
    failures.forEach((failure) => console.log(`❌ ${failure}`));
    if (problems.length > 0) {
      console.log('\nChi tiết log:');
      problems.slice(0, 5).forEach((problem) => console.log(`   - ${problem.slice(0, 200)}`));
    }
    process.exit(1);
  }

  /* ---------------- 5. Kiểm tra ô chọn ảnh dùng chung (upload) ---------------- */
  const uploadContainer = window.document.createElement('div');
  window.document.body.appendChild(uploadContainer);
  const uploadRoot = createRoot(uploadContainer as unknown as HTMLElement);
  uploadRoot.render(
    React.createElement(
      Providers,
      null,
      React.createElement(ImageUploadField, {
        value: '/upload/categories/2026/10/anh-mau.jpg',
        onChange: () => undefined,
        folder: 'categories',
        label: 'Ảnh đại diện danh mục',
      }),
    ),
  );
  await wait(300);

  const uploadButtons = [...uploadContainer.querySelectorAll('button')].map((button) => button.textContent ?? '');
  const uploadProblems = problems.filter((message) => /must be used within|not wrapped|Missing/i.test(message));

  console.log('');
  console.log(`Ô chọn ảnh - nút hiển thị : ${uploadButtons.join(' | ')}`);

  if (uploadProblems.length > 0) {
    console.log('❌ Ô chọn ảnh gặp lỗi runtime:');
    uploadProblems.slice(0, 3).forEach((problem) => console.log(`   - ${problem.slice(0, 200)}`));
    process.exit(1);
  }
  if (!uploadButtons.some((text) => text.includes('Đổi ảnh khác'))) {
    console.log('❌ Ô chọn ảnh không render nút upload/xem trước');
    process.exit(1);
  }

  /* ---------------- 6. Kiểm tra dropdown xã/phường (autocomplete) ---------------- */
  const wardContainer = window.document.createElement('div');
  window.document.body.appendChild(wardContainer);
  const wardRoot = createRoot(wardContainer as unknown as HTMLElement);
  wardRoot.render(
    React.createElement(
      Providers,
      null,
      React.createElement(WardCombobox, { value: 'Xã Phước Hải', onChange: () => undefined, id: 'ward-test' }),
    ),
  );
  await wait(300);

  const wardTrigger = wardContainer.querySelector('#ward-test') as HTMLButtonElement | null;
  console.log('');
  console.log(`Dropdown xã/phường - nhãn: ${wardTrigger?.textContent?.trim() ?? '(không thấy)'}`);

  if (!wardTrigger) {
    console.log('❌ Không render được dropdown xã/phường');
    process.exit(1);
  }
  if (!(wardTrigger.textContent ?? '').includes('Xã Phước Hải')) {
    console.log('❌ Dropdown không hiển thị xã/phường đã chọn');
    process.exit(1);
  }

  console.log('\n✅ Editor + ô chọn ảnh + dropdown xã/phường mount thành công (không lỗi runtime).');
  root.unmount();
  uploadRoot.unmount();
  wardRoot.unmount();
  process.exit(0);
}

main().catch((error) => {
  console.error('Không chạy được test render:', error);
  process.exit(1);
});
