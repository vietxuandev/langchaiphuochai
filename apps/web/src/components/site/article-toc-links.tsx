'use client';

import { useEffect } from 'react';

/**
 * Gắn id cho heading và biến danh sách "Mục lục" thành link nội bộ.
 *
 * Nội dung bài viết được nhập từ nhiều nguồn (MCP, admin cũ) nên không phải
 * bài nào cũng có sẵn id trên heading. Component này xử lý sau khi render,
 * giúp mục lục luôn click được mà không cần sửa lại HTML đã lưu.
 */
export function ArticleTocLinks() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.prose-phuochai');
    if (!root) return;

    const headings = Array.from(root.querySelectorAll<HTMLElement>('h2, h3'));
    const tocTitle = Array.from(root.querySelectorAll<HTMLElement>('strong')).find(
      (element) => element.textContent?.trim().toLowerCase() === 'mục lục',
    );
    const toc = tocTitle?.closest('div');
    const items = toc ? Array.from(toc.querySelectorAll<HTMLLIElement>('li')) : [];

    if (headings.length === 0 || items.length === 0) return;

    const usedIds = new Set<string>();
    const makeId = (text: string, index: number) => {
      const base =
        text
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/gi, 'd')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || `muc-${index + 1}`;

      let id = base;
      let suffix = 2;
      while (usedIds.has(id)) {
        id = `${base}-${suffix}`;
        suffix += 1;
      }
      usedIds.add(id);
      return id;
    };

    headings.forEach((heading, index) => {
      if (!heading.id) heading.id = makeId(heading.textContent ?? '', index);
      heading.classList.add('scroll-mt-24');
    });

    const normalize = (text: string) =>
      text
        .toLowerCase()
        .replace(/^\s*\d+[.)]\s*/, '')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();

    for (const item of items) {
      if (item.querySelector('a[href^="#"]')) continue;

      const itemText = normalize(item.textContent ?? '');
      const target =
        headings.find((heading) => normalize(heading.textContent ?? '') === itemText) ??
        headings.find((heading) =>
          normalize(heading.textContent ?? '').startsWith(itemText.slice(0, 32)),
        );

      if (!target?.id) continue;

      const link = document.createElement('a');
      link.href = `#${target.id}`;
      link.className = 'hover:text-primary hover:underline';
      while (item.firstChild) link.appendChild(item.firstChild);
      item.appendChild(link);
    }
  }, []);

  return null;
}
