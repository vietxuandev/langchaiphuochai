/**
 * PHẦN PORT TỪ `phuochai-scraper` (dự án crawl cũ) - giữ nguyên logic parse để
 * dữ liệu crawl mới có cùng cấu trúc với dữ liệu đã import.
 *
 * Chỉ thay đổi: bỏ phần đọc/ghi file + CLI + state, và bỏ đuôi `.js` trong import
 * để chạy trong NestJS (CommonJS).
 */
/** Parser cho "Tin tức / cẩm nang": /tin-tuc/<slug>-<id>.html */
import { clean, parseNumber, splitAddress } from '../../lib/text';
import { collectImages, extractItemCategory, paragraphTexts, type Doc } from '../../lib/html';
import { emptyTemplateResult, type TemplateResult } from '../types';

export function parseArticle($: Doc, pageUrl: string): TemplateResult {
  const result = emptyTemplateResult();

  result.title = clean($('h1').first().text());

  // Dòng "Mã tin: 167 | Xem: 328"
  const codeParagraph = $('p')
    .filter((_, el) => /Mã tin\s*:/i.test($(el).text()))
    .first();
  if (codeParagraph.length > 0) {
    const text = clean(codeParagraph.text()) ?? '';
    const codeMatch = text.match(/Mã tin\s*:\s*([\w.-]+)/i);
    const viewMatch = text.match(/Xem\s*:\s*([\d.,]+)/i);
    result.code = clean(codeMatch?.[1] ?? null);
    result.views = viewMatch?.[1] ? parseNumber(viewMatch[1]) : null;
    result.extras.codeLine = text;
  }

  // Địa điểm nằm ngay sau tiêu đề.
  const $h1 = $('h1').first();
  const locationParagraph = $h1
    .nextAll('p')
    .filter((_, el) => $(el).find('i.fa-map-marker-alt, i.fas.fa-map-marker-alt').length > 0)
    .first();
  const addressText = locationParagraph.length > 0 ? clean(locationParagraph.text()) : null;
  result.extras.address = splitAddress(addressText);

  // Sapo: đoạn in đậm ngay sau dòng "Mã tin".
  const summaryParagraph = $('p.mb-1')
    .filter((_, el) => {
      const text = $(el).text();
      return !/Mã tin\s*:/i.test(text) && $(el).find('strong').length > 0;
    })
    .first();
  if (summaryParagraph.length > 0) {
    result.summary = clean(summaryParagraph.find('strong').first().text()) ?? clean(summaryParagraph.text());
  }
  if (!result.summary) {
    const afterCode = paragraphTexts($, $('.col-lg-9').first()).find(
      (p) => !/Mã tin/i.test(p) && p.length > 80,
    );
    result.summary = afterCode ?? null;
  }

  result.category = extractItemCategory($, pageUrl);

  result.images = collectImages($, pageUrl, [
    { selector: '.news-media img', role: 'hero' },
    { selector: '#newsCarousel img', role: 'hero' },
    { selector: '.box-detail.post-content img', role: 'content' },
    { selector: '.post-content img', role: 'content' },
  ]);

  if (!result.title) result.warnings.push('Không tìm thấy tiêu đề (h1)');
  if (!result.code) result.warnings.push('Không tìm thấy "Mã tin"');

  return result;
}
