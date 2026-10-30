/**
 * PHẦN PORT TỪ `phuochai-scraper` (dự án crawl cũ) - giữ nguyên logic parse để
 * dữ liệu crawl mới có cùng cấu trúc với dữ liệu đã import.
 *
 * Chỉ thay đổi: bỏ phần đọc/ghi file + CLI + state, và bỏ đuôi `.js` trong import
 * để chạy trong NestJS (CommonJS).
 */
/** Parser cho "Bất động sản": /bat-dong-san/<slug>-<id>.html */
import { clean, parseNumber, parsePrice, splitAddress } from '../../lib/text';
import { collectImages, extractItemCategory, type Doc } from '../../lib/html';
import type { PriceInfo, PropertyDetails } from '../../types';
import { emptyTemplateResult, type TemplateResult } from '../types';

/** Đọc khối "Mức giá" / "Diện tích": nhãn + giá trị chính + giá trị phụ. */
function parseLabelBlock(
  $: Doc,
  label: RegExp,
): { primary: string | null; secondary: string | null } | null {
  const labelEl = $('span.text-secondary')
    .filter((_, el) => label.test(clean($(el).text()) ?? ''))
    .first();
  if (labelEl.length === 0) return null;
  const column = labelEl.parent();
  const primary = clean(column.find('strong').first().text());
  const secondary = clean(column.find('span.text-secondary.size-08').first().text());
  return { primary, secondary };
}

export function parseRealEstate($: Doc, pageUrl: string): TemplateResult {
  const result = emptyTemplateResult();

  result.title =
    clean($('h2.size-13.font-weight-bold').first().text()) ??
    clean($('h2').first().text()) ??
    clean($('h1').first().text());

  result.category = extractItemCategory($, pageUrl);

  // ----- Giá -----
  const priceBlock = parseLabelBlock($, /^mức giá$/i);
  const areaBlock = parseLabelBlock($, /^diện tích$/i);
  const modalPrice = clean($('#modalProSer strong.text-danger').first().text());
  const priceRaw = priceBlock?.primary ?? modalPrice;
  if (priceRaw) {
    const parsed = parsePrice(priceRaw);
    const perM2 = priceBlock?.secondary ?? null;
    const perM2Parsed = perM2 ? parsePrice(perM2.replace(/\s*\/\s*m²?/i, '')) : null;
    const price: PriceInfo = {
      ...parsed,
      value: parsed.value ?? (modalPrice ? parseNumber(modalPrice) : null),
      perM2Raw: perM2,
      perM2Value: perM2Parsed?.value ?? null,
    };
    result.price = price;
  }

  // ----- Thuộc tính bất động sản -----
  const attributes: Record<string, string> = {};
  $('.property-info .property-item').each((_, el) => {
    const label = clean($(el).find('.property-label').first().text());
    const value = clean($(el).find('.property-value').first().text());
    if (label && value) attributes[label] = value;
  });

  const dimensions = attributes['Ngang x Dài'] ?? null;
  const dimensionMatch = dimensions?.match(/([\d.,]+)\s*x\s*([\d.,]+)/i);
  const areaText = areaBlock?.primary ?? null;
  const areaMatch = areaText?.match(/([\d.,]+)\s*m²?/i);
  const roadWidth = attributes['Đường trước nhà'] ?? null;
  // "Ngang 10 m" trong khối Diện tích là nguồn dự phòng cho chiều ngang.
  const secondaryWidth = areaBlock?.secondary?.match(/([\d.,]+)/)?.[1] ?? null;

  const property: PropertyDetails = {
    areaText,
    areaM2: areaMatch?.[1] ? parseNumber(areaMatch[1]) : null,
    widthM: dimensionMatch?.[1] ? parseNumber(dimensionMatch[1]) : parseNumber(secondaryWidth),
    lengthM: dimensionMatch?.[2] ? parseNumber(dimensionMatch[2]) : null,
    dimensions,
    bedrooms: attributes['Phòng ngủ'] ? parseNumber(attributes['Phòng ngủ']) : null,
    bathrooms: attributes['WC'] ? parseNumber(attributes['WC']) : null,
    floors: attributes['Hiện trạng'] ? parseNumber(attributes['Hiện trạng']) : null,
    direction: attributes['Hướng'] ?? null,
    roadWidth,
    legal: attributes['Pháp lý'] ?? null,
    attributes,
  };
  // Chỉ giữ khối property nếu thực sự có dữ liệu.
  if (Object.keys(attributes).length > 0 || areaText || priceBlock) result.property = property;

  // ----- Địa chỉ -----
  const addressParagraph = $('i.fa-map-marker-alt, i.fas.fa-map-marker-alt')
    .first()
    .parent();
  const addressText = addressParagraph.length > 0 ? clean(addressParagraph.text()) : null;
  result.extras.address = splitAddress(addressText);
  result.extras.areaBlock = areaBlock;
  result.extras.priceBlock = priceBlock;

  // ----- Ảnh -----
  result.images = collectImages($, pageUrl, [
    { selector: '.owl-carousel-images img', role: 'gallery' },
    { selector: '.carousel-inner img', role: 'gallery' },
    { selector: '#imageModal img#modalImage', role: 'gallery' },
    { selector: '.box-projcet-content img', role: 'content' },
    { selector: '.post-content img', role: 'content' },
  ]);

  if (!result.title) result.warnings.push('Không tìm thấy tiêu đề');
  if (!result.price) result.warnings.push('Không tìm thấy giá');

  return result;
}
