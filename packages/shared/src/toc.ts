/**
 * Mục lục (TOC) của bài viết - một định dạng duy nhất cho mọi nguồn (crawler, MCP, editor, script).
 *
 * Định dạng chuẩn (số thứ tự do CSS tự đánh, KHÔNG viết số vào chữ):
 *
 *   <div id="main-toc">
 *   <strong>Mục lục</strong>
 *   <ul>
 *   <li><a href="#menu1">Tiêu đề H2</a>
 *   <ul>
 *   <li><a href="#menu2">Tiêu đề H3</a></li>
 *   </ul>
 *   </li>
 *   </ul>
 *   </div>
 *
 * `normalizeToc` bỏ TOC cũ (kể cả kiểu `<div name="tableOfContents" style="margin-left:..">`),
 * bổ sung `id` cho H2/H3 còn thiếu rồi dựng lại TOC từ các heading. Chạy lại nhiều lần cho cùng kết quả.
 */

export interface TocNormalizeResult {
  html: string;
  /** HTML đầu ra khác HTML đầu vào. */
  changed: boolean;
  /** Số mục H2 trong TOC (0 = bài không có TOC). */
  sections: number;
}

const TOC_OPENING = /<div[^>]*\bid=["']main-toc["'][^>]*>/i;
const HEADING = /<(h[23])\b([^>]*)>([\s\S]*?)<\/\1>/gi;
/** Số thứ tự viết tay ở đầu heading: "1.", "2)", "3.1." */
const LEADING_NUMBER = /^\d+(?:\.\d+)*[.)]\s*/;

function decodeBasic(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&');
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function headingLabel(inner: string): string {
  const text = decodeBasic(inner.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  return text.replace(LEADING_NUMBER, '').trim();
}

/** Vị trí khối TOC (đếm `<div>` lồng nhau để lấy đúng thẻ đóng). */
function findTocBlock(html: string): { start: number; end: number } | null {
  const opening = TOC_OPENING.exec(html);
  if (!opening) return null;
  const start = opening.index;
  const tag = /<\/?div\b[^>]*>/gi;
  tag.lastIndex = start + opening[0].length;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(html))) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return { start, end: match.index + match[0].length };
  }
  return null;
}

/** Bỏ khối TOC (nếu có), trả về phần còn lại đã trim. */
export function removeToc(html: string): string {
  const block = findTocBlock(html);
  if (!block) return html;
  return `${html.slice(0, block.start)}${html.slice(block.end)}`.trim();
}

interface TocEntry {
  id: string;
  label: string;
  level: 2 | 3;
}

function buildTocHtml(entries: TocEntry[]): string {
  const lines = ['<div id="main-toc">', '<strong>Mục lục</strong>', '<ul>'];
  let openItem = false;
  let openSub = false;

  const closeSub = () => {
    if (openSub) lines.push('</ul>');
    openSub = false;
  };
  const closeItem = () => {
    closeSub();
    if (openItem) lines.push('</li>');
    openItem = false;
  };

  for (const entry of entries) {
    const link = `<a href="#${entry.id}">${escapeHtml(entry.label)}</a>`;
    if (entry.level === 2) {
      closeItem();
      lines.push(`<li>${link}`);
      openItem = true;
    } else {
      if (!openItem) continue; // H3 đứng trước H2 đầu tiên: bỏ qua
      if (!openSub) {
        lines.push('<ul>');
        openSub = true;
      }
      lines.push(`<li>${link}</li>`);
    }
  }
  closeItem();
  lines.push('</ul>', '</div>');
  return lines.join('\n');
}

/**
 * Chuẩn hoá mục lục: bỏ TOC cũ, bổ sung id cho H2/H3, dựng lại TOC chuẩn ở đầu bài.
 * Bài có ít hơn 2 H2 thì không có TOC.
 */
export function normalizeToc(html: string | null | undefined): TocNormalizeResult {
  const original = html ?? '';
  if (!original.trim()) return { html: original, changed: false, sections: 0 };

  const withoutToc = removeToc(original);

  const used = new Set<string>(
    [...withoutToc.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]),
  );
  let counter = 0;
  const nextId = (): string => {
    do counter += 1;
    while (used.has(`menu${counter}`));
    const id = `menu${counter}`;
    used.add(id);
    return id;
  };

  const entries: TocEntry[] = [];
  const body = withoutToc.replace(HEADING, (full, tag: string, attrs: string, inner: string) => {
    const level = tag.toLowerCase() === 'h2' ? 2 : 3;
    const existing = /\bid=["']([^"']+)["']/i.exec(attrs)?.[1];
    const id = existing ?? nextId();
    const label = headingLabel(inner);
    if (label) entries.push({ id, label, level });
    return existing ? full : `<${tag}${attrs} id="${id}">${inner}</${tag}>`;
  });

  const sections = entries.filter((entry) => entry.level === 2).length;
  const next = sections >= 2 ? `${buildTocHtml(entries)}\n\n${body}` : body;
  return { html: next, changed: next !== original, sections: sections >= 2 ? sections : 0 };
}
