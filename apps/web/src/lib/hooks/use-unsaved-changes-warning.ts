'use client';

import { useEffect } from 'react';

const DEFAULT_MESSAGE = 'Bạn có thay đổi chưa lưu. Rời trang bây giờ sẽ mất các thay đổi này. Vẫn rời trang?';

/**
 * Cảnh báo khi rời trang lúc form còn thay đổi chưa lưu:
 *  - đóng tab, tải lại, gõ URL khác: hộp thoại `beforeunload` của trình duyệt;
 *  - bấm link trong app (menu bên trái, nút quay lại...): hỏi xác nhận trước khi chuyển trang.
 *
 * Next App Router chưa có API chặn chuyển trang, nên bắt click ở pha capture: huỷ sự kiện thì
 * `<Link>` không điều hướng. `router.push` do chính form gọi (sau khi lưu) không bị chặn.
 */
export function useUnsavedChangesWarning(when: boolean, message: string = DEFAULT_MESSAGE): void {
  useEffect(() => {
    if (!when) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Một số trình duyệt chỉ hiện hộp thoại khi có returnValue
      event.returnValue = '';
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; // mở tab mới

      const target = event.target as Element | null;
      const anchor = target?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return; // link ra ngoài: beforeunload sẽ hỏi
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [when, message]);
}
