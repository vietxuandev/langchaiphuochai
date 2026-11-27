/** Số từ tối thiểu của phần nội dung chính để trang được index (tránh "nội dung ít giá trị"). */
export const MIN_INDEXABLE_WORDS = 250;

/** Đếm số từ trong HTML nội dung bài viết (bỏ thẻ, script, style). */
export function countContentWords(html: string | null | undefined): number {
  if (!html) return 0;
  const text = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');
  return text.split(/\s+/).filter(Boolean).length;
}

/** Trang chi tiết có nội dung quá mỏng: không đưa vào sitemap và gắn noindex. */
export function isThinContent(type: string, html: string | null | undefined): boolean {
  // Trang tĩnh (chính sách, liên hệ...) luôn được index.
  if (type === 'PAGE') return false;
  return countContentWords(html) < MIN_INDEXABLE_WORDS;
}
