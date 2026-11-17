import sanitizeHtml from 'sanitize-html';

/**
 * Lọc HTML nội dung bài viết trước khi lưu (chống XSS).
 *
 * Trang công khai render `contentHtml` bằng `dangerouslySetInnerHTML`, nên MỌI đường ghi
 * (GraphQL createPost/updatePost, MCP, crawler) đều phải đi qua `sanitizePostHtml`.
 *
 * Allowlist được dựng từ những gì nội dung thật đang dùng:
 *  - output của editor Tiptap: heading 2-4, căn lề, bảng (colspan/rowspan/colwidth, colgroup), ảnh, link;
 *  - HTML kế thừa từ site cũ: mục lục `#menuN`, thuộc tính `name=`, class Bootstrap, style margin/width;
 *  - mẫu mục lục của skill viết bài: `<div id="main-toc">`, `<figure>`/`<figcaption>`.
 *
 * Bị loại bỏ: script/style/iframe/form/svg, thuộc tính sự kiện (`on*`), URL `javascript:`/`data:`,
 * style ngoài danh sách (position, z-index, url(...), số âm) và class lạ.
 */

/** Độ dài CSS hợp lệ (không cho số âm để tránh đẩy nội dung đè lên giao diện). */
const CSS_LENGTH = /^\d+(\.\d+)?(px|em|rem|%|pt)$/;
const CSS_SIZE = [CSS_LENGTH, /^auto$/];
const CSS_COLOR = [
  /^#[0-9a-f]{3,8}$/i,
  /^rgba?\(\s*\d{1,3}%?\s*(,\s*\d{1,3}%?\s*){2}(,\s*(0|1|0?\.\d+)\s*)?\)$/i,
  /^[a-z]{3,20}$/i,
];

/** id/name dùng làm neo cho mục lục (`menu1`, `main-toc`, `tableOfContents`...). */
const SAFE_ANCHOR = /^[A-Za-z][\w-]{0,79}$/;

/** Giá trị `rel` được giữ lại trên thẻ `<a>`. */
const REL_TOKENS = new Set(['noopener', 'noreferrer', 'nofollow', 'ugc', 'sponsored']);

/** Class Bootstrap có sẵn trong nội dung kế thừa từ site cũ (không cho class tuỳ ý). */
const LEGACY_CLASSES = [
  'btn',
  'btn-sm',
  'btn-primary',
  'mb-1',
  'mt-2',
  'clearfix',
  'w-5',
  'text-center',
  'text-danger',
  'text-uppercase',
  'table',
  'table-bordered',
];

export const POST_HTML_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u', 's', 'del', 'sub', 'sup', 'mark', 'small', 'span',
    'blockquote', 'code', 'pre', 'ul', 'ol', 'li',
    'a', 'img', 'figure', 'figcaption', 'div',
    'table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    ol: ['start', 'reversed', 'type'],
    th: ['colspan', 'rowspan', 'colwidth', 'scope'],
    td: ['colspan', 'rowspan', 'colwidth'],
    col: ['span', 'width'],
    '*': ['id', 'name', 'class', 'style'],
  },
  allowedClasses: {
    code: ['language-*'],
    '*': LEGACY_CLASSES,
  },
  allowedStyles: {
    '*': {
      'text-align': [/^(left|right|center|justify|start|end)$/],
      'margin-left': [CSS_LENGTH],
      'padding-left': [CSS_LENGTH],
      width: CSS_SIZE,
      'min-width': CSS_SIZE,
      'max-width': CSS_SIZE,
      height: CSS_SIZE,
      color: CSS_COLOR,
      'background-color': CSS_COLOR,
      'font-size': [CSS_LENGTH],
      'font-weight': [/^(normal|bold|bolder|lighter|[1-9]00)$/],
      'font-style': [/^(normal|italic)$/],
      'text-decoration': [/^(none|underline|line-through)$/],
      'vertical-align': [/^(top|middle|bottom|baseline)$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  disallowedTagsMode: 'discard',
  transformTags: {
    a: (tagName, attribs) => {
      const next = { ...attribs };
      if (next.target && next.target !== '_blank') delete next.target;

      const rel = new Set(
        (next.rel ?? '')
          .toLowerCase()
          .split(/\s+/)
          .filter((token) => REL_TOKENS.has(token)),
      );
      // Link mở tab mới luôn kèm noopener để trang đích không điều khiển được tab gốc
      if (next.target === '_blank') {
        rel.add('noopener');
        rel.add('noreferrer');
      }
      if (rel.size > 0) next.rel = [...rel].join(' ');
      else delete next.rel;

      return { tagName, attribs: next };
    },
    '*': (tagName, attribs) => {
      const next = { ...attribs };
      for (const key of ['id', 'name']) {
        if (next[key] !== undefined && !SAFE_ANCHOR.test(next[key])) delete next[key];
      }
      return { tagName, attribs: next };
    },
  },
};

/** Lọc HTML bài viết theo allowlist ở trên. Chuỗi rỗng sau khi lọc vẫn trả về chuỗi rỗng. */
export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, POST_HTML_SANITIZE_OPTIONS);
}

/** Chuyển HTML thành text thuần (dùng cho tìm kiếm `contentText`). */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
