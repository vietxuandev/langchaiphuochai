/**
 * Chuẩn hoá SEO/format cho bài NEWS đã có, không viết lại nội dung.
 *
 * Các thay đổi an toàn:
 * - Tạo lại mục lục từ H2, bỏ TOC cũ (kể cả TOC có name/style).
 * - Bổ sung id menuN cho H2 còn thiếu; giữ id cũ nếu đã có.
 * - Bổ sung seoTitle nếu thiếu.
 * - Chuẩn hoá summary quá ngắn/quá dài.
 *
 * Không sửa nội dung đoạn văn, ảnh, link, heading text.
 */

export interface NewsSeoMetrics {
  hasToc: boolean;
  h2Count: number;
  h2WithId: number;
  summaryLength: number;
  seoTitleLength: number;
  contentLength: number;
}

export interface NewsSeoResult {
  html: string;
  seoTitle: string;
  summary: string;
  changes: string[];
  before: NewsSeoMetrics;
  after: NewsSeoMetrics;
}

function metrics(html: string, summary: string, seoTitle: string): NewsSeoMetrics {
  return {
    hasToc: /id=["']main-toc["']/i.test(html),
    h2Count: (html.match(/<h2\b/gi) ?? []).length,
    h2WithId: (html.match(/<h2[^>]*\bid=/gi) ?? []).length,
    summaryLength: summary.trim().length,
    seoTitleLength: seoTitle.trim().length,
    contentLength: html.length,
  };
}

function decodeBasic(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function textOnly(value: string): string {
  return decodeBasic(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function truncateAtWord(value: string, max: number, ellipsis = true): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const at = cut.lastIndexOf(' ');
  const result = (at > max * 0.65 ? cut.slice(0, at) : cut).trim();
  return ellipsis ? `${result}…` : result;
}

/** Bỏ đúng block <div id="main-toc">...</div> bằng cách đếm div lồng nhau. */
function removeToc(html: string): string {
  const opening = /<div[^>]*\bid=["']main-toc["'][^>]*>/i.exec(html);
  if (!opening) return html;
  const start = opening.index;
  let cursor = start + opening[0].length;
  let depth = 1;
  const tag = /<\/?div\b[^>]*>/gi;
  tag.lastIndex = cursor;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(html))) {
    if (/^<\//.test(match[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) {
      return `${html.slice(0, start)}${html.slice(match.index + match[0].length)}`.trim();
    }
  }
  return html;
}

function buildToc(items: Array<{ id: string; label: string }>): string {
  return [
    '<div id="main-toc">',
    '<strong>Mục lục</strong>',
    ...items.map((item, index) => `  <div><a href="#${item.id}">${index + 1}. ${item.label}</a></div>`),
    '</div>',
  ].join('\n');
}

function findTocBlock(html: string): { start: number; end: number; block: string } | null {
  const opening = /<div[^>]*\bid=["']main-toc["'][^>]*>/i.exec(html);
  if (!opening) return null;
  const start = opening.index;
  let cursor = start + opening[0].length;
  let depth = 1;
  const tag = /<\/?div\b[^>]*>/gi;
  tag.lastIndex = cursor;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(html))) {
    if (/^<\//.test(match[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) {
      const end = match.index + match[0].length;
      return { start, end, block: html.slice(start, end) };
    }
  }
  return null;
}

function tocRefs(block: string): Set<string> {
  return new Set([...block.matchAll(/href=["']#([^"']+)["']/gi)].map((match) => match[1]));
}

export function normalizeNewsSeo(html: string, title: string, currentSummary: string | null, currentSeoTitle: string | null): NewsSeoResult {
  const before = metrics(html, currentSummary ?? '', currentSeoTitle ?? '');
  const changes: string[] = [];
  const used = new Set<string>();
  const toc: Array<{ id: string; label: string }> = [];
  let index = 0;

  const oldToc = findTocBlock(html);
  const oldRefs = oldToc ? tocRefs(oldToc.block) : new Set<string>();

  // Chỉ sửa heading/id; không tự đổi nội dung.
  let body = html.replace(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi, (full, attrs: string, inner: string) => {
    index += 1;
    const existing = /\bid=["']([^"']+)["']/i.exec(attrs)?.[1]?.trim();
    let id = existing || `menu${index}`;
    if (used.has(id)) {
      id = `menu${index}`;
      if (used.has(id)) {
        let suffix = 2;
        while (used.has(`menu${index}-${suffix}`)) suffix += 1;
        id = `menu${index}-${suffix}`;
      }
    }
    used.add(id);

    let nextAttrs = attrs;
    if (existing && existing !== id) nextAttrs = attrs.replace(/\bid=["'][^"']+["']/i, `id="${id}"`);
    if (!existing) nextAttrs = `${attrs} id="${id}"`;

    const label = textOnly(inner) || `Mục ${index}`;
    toc.push({ id, label });
    return `<h2${nextAttrs}>${inner}</h2>`;
  });

  const hasAllTocLinks = toc.length > 0 && toc.every((item) => oldRefs.has(item.id));
  const needsToc = toc.length >= 2 && (!oldToc || !hasAllTocLinks);

  if (needsToc) {
    body = removeToc(body).trim();
    body = `${buildToc(toc)}\n\n${body}`;
    changes.push(oldToc ? 'Chuẩn hoá mục lục' : 'Thêm mục lục');
  } else if (oldToc && toc.length < 2) {
    body = removeToc(body).trim();
    changes.push('Bỏ TOC cũ (bài ít hơn 2 H2)');
  }

  if (before.h2WithId < toc.length) changes.push('Bổ sung id cho H2');

  let summary = (currentSummary ?? '').trim();
  if (!summary || summary.length < 80) {
    const firstParagraph = body.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '';
    const candidate = truncateAtWord(textOnly(firstParagraph), 155);
    if (candidate.length >= 80) {
      summary = candidate;
      changes.push('Bổ sung/rút gọn summary');
    }
  } else if (summary.length > 170) {
    summary = truncateAtWord(summary, 160);
    changes.push('Rút gọn summary > 170 ký tự');
  }

  let seoTitle = (currentSeoTitle ?? '').trim();
  if (!seoTitle) {
    seoTitle = truncateAtWord(title, 70, false);
    changes.push('Bổ sung seoTitle');
  } else if (seoTitle.length > 70) {
    seoTitle = truncateAtWord(seoTitle, 70, false);
    changes.push('Rút gọn seoTitle');
  }

  const after = metrics(body, summary, seoTitle);
  return { html: body, seoTitle, summary, changes: [...new Set(changes)], before, after };
}
