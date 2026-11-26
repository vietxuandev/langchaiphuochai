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
 * Heading KHÔNG đánh số tay ("1. Giới thiệu"): `normalizeToc` tự bỏ số đó, TOC mới là nơi duy nhất hiện số.
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

/** Bỏ số viết tay ở đầu heading (kể cả khi nằm trong <strong>): "1. Giới thiệu" -> "Giới thiệu". */
function stripHeadingNumber(inner: string): string {
  return inner.replace(/^(\s*(?:<[^>]+>\s*)*)\d+(?:\.\d+)*[.)]\s+/, '$1');
}

function headingLabel(inner: string): string {
  return decodeBasic(inner.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
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

/** TOC "phẳng" do editor tạo: <p><strong>Mục lục</strong></p> rồi mỗi mục là một <p><a href="#..">. */
const PARAGRAPH_TOC =
  /<p>\s*<strong>\s*Mục lục\s*<\/strong>\s*<\/p>(?:\s*<p>\s*<a\b[^>]*\bhref=["']#[^"']*["'][^>]*>[\s\S]*?<\/a>\s*<\/p>)*/gi;

/** Bỏ mọi khối TOC (kiểu div#main-toc và kiểu đoạn <p> phẳng), trả về phần còn lại đã trim. */
export function removeToc(html: string): string {
  let result = html;
  for (let block = findTocBlock(result); block; block = findTocBlock(result)) {
    result = `${result.slice(0, block.start)}${result.slice(block.end)}`;
  }
  return result.replace(PARAGRAPH_TOC, '').trim();
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
    const cleanInner = stripHeadingNumber(inner);
    const label = headingLabel(cleanInner);
    if (label) entries.push({ id, label, level });
    return `<${tag}${attrs}${existing ? '' : ` id="${id}"`}>${cleanInner}</${tag}>`;
  });

  const sections = entries.filter((entry) => entry.level === 2).length;
  const next = sections >= 2 ? `${buildTocHtml(entries)}\n\n${body}` : body;
  return { html: next, changed: next !== original, sections: sections >= 2 ? sections : 0 };
}
