/**
 * PHẦN PORT TỪ `phuochai-scraper` (dự án crawl cũ) - giữ nguyên logic parse để
 * dữ liệu crawl mới có cùng cấu trúc với dữ liệu đã import.
 *
 * Chỉ thay đổi: bỏ phần đọc/ghi file + CLI + state, và bỏ đuôi `.js` trong import
 * để chạy trong NestJS (CommonJS).
 */
/** Parser cho các trang tĩnh: giới thiệu, FAQ, bảng giá, hướng dẫn... */
import { clean } from '../../lib/text';
import { collectImages, extractItemCategory, type Doc } from '../../lib/html';
import { emptyTemplateResult, type TemplateResult } from '../types';

export function parseGenericPage($: Doc, pageUrl: string): TemplateResult {
  const result = emptyTemplateResult();

  result.title = clean($('h1').first().text()) ?? clean($('h2').first().text());

  // Sapo: đoạn văn ngay sau tiêu đề, trước phần nội dung chi tiết.
  const $h1 = $('h1').first();
  const lead = $h1
    .nextAll('p')
    .filter((_, el) => (clean($(el).text()) ?? '').length > 40)
    .first();
  result.summary = lead.length > 0 ? clean(lead.text()) : null;

  result.category = extractItemCategory($, pageUrl);
  result.images = collectImages($, pageUrl, [
    { selector: '.post-content img', role: 'content' },
    { selector: '.box-detail img', role: 'content' },
    { selector: '.article-media img', role: 'gallery' },
  ]);

  if (!result.title) result.warnings.push('Không tìm thấy tiêu đề');
  return result;
}
