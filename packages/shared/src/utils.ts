/** Tiện ích dùng chung cho cả hai phía (thuần JS, không phụ thuộc framework). */
import { PostType, POST_TYPE_PATHS } from './enums';

/** Bỏ dấu tiếng Việt. */
export function deaccent(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** Tạo slug từ tiếng Việt: "Homestay Phước Hải" -> "homestay-phuoc-hai". */
export function slugify(input: string, maxLength = 90): string {
  const base = deaccent(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (base || 'bai-viet').slice(0, maxLength).replace(/-+$/g, '');
}

/** Định dạng giá VND: 12877815 -> "12.877.815 ₫". */
export function formatVnd(value: number | null | undefined): string {
  if (value == null) return 'Thương lượng';
  return `${new Intl.NumberFormat('vi-VN').format(value)} ₫`;
}

/** Định dạng giá gọn: 17_000_000_000 -> "17 tỷ"; 550_000 -> "550 nghìn". */
export function formatPriceShort(value: number | null | undefined): string {
  if (value == null) return 'Thương lượng';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(value % 1_000_000_000 === 0 ? 0 : 1)} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)} triệu`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)} nghìn`;
  return formatVnd(value);
}

/** Rút gọn số lớn cho thống kê: 1234 -> "1,2 N". */
export function formatCompact(value: number | null | undefined): string {
  if (value == null) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.0', '')} Tr`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace('.0', '')} N`;
  return String(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function truncate(input: string | null | undefined, max = 160): string {
  if (!input) return '';
  const plain = input.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return plain.length <= max ? plain : `${plain.slice(0, max - 1)}…`;
}

/** URL public của một bài viết. */
export function buildPostUrl(type: PostType, slug: string): string {
  return `${POST_TYPE_PATHS[type]}/${slug}`;
}

/** Text hiển thị địa chỉ từ các phần đã tách. */

/* -------------------------------------------------------------------------- */
/*                          Nội dung bài viết (HTML)                          */
/* -------------------------------------------------------------------------- */

/** Khối "Tags:" do site cũ chèn ở cuối bài (tag đã hiển thị riêng từ quan hệ tags). */
const TAGS_BLOCK_PATTERN = /<div[^>]*>\s*<strong>\s*Tags\s*:\s*<\/strong>[\s\S]*?<\/div>\s*/gi;

/**
 * Bỏ khối "Tags: ..." ở cuối nội dung HTML.
 *
 * Site cũ chèn danh sách tag vào cuối mỗi bài, trong khi website mới hiển thị tag
 * từ quan hệ `Post.tags` - nên nếu giữ lại sẽ bị trùng.
 */
export function stripTagsBlock(html: string | null | undefined): string {
  if (!html) return html ?? '';
  return html.replace(TAGS_BLOCK_PATTERN, '').trimEnd();
}

/**
 * Bỏ phần "Tags: ..." ở cuối văn bản thuần (bản `contentText`).
 *
 * Chỉ cắt khi phần sau "Tags:" giống một danh sách tag (không có dấu câu kết câu)
 * và nằm trong 1000 ký tự cuối - tránh cắt nhầm nội dung khác.
 */
export function stripTagsText(text: string | null | undefined): string {
  if (!text) return text ?? '';
  const match = /\s*Tags\s*:/i.exec(text);
  if (!match) return text;

  const tail = text.slice(match.index);
  const tailLength = text.length - match.index;

  // "Câu văn" = có dấu kết câu theo sau là khoảng trắng.
  // Lưu ý: tag có thể chứa dấu chấm (ví dụ "TP.HCM", "cấp 1.2") nên không được chặn mọi dấu chấm.
  const body = tail.replace(/^\s*Tags\s*:/i, '').trimEnd();
  const looksLikeSentence = /[.!?]\s/.test(body);

  if (tailLength > 1000 || looksLikeSentence) return text;
  return text.slice(0, match.index).trimEnd();
}
