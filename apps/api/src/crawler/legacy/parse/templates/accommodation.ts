/**
 * PHẦN PORT TỪ `phuochai-scraper` (dự án crawl cũ) - giữ nguyên logic parse để
 * dữ liệu crawl mới có cùng cấu trúc với dữ liệu đã import.
 *
 * Chỉ thay đổi: bỏ phần đọc/ghi file + CLI + state, và bỏ đuôi `.js` trong import
 * để chạy trong NestJS (CommonJS).
 */
/** Parser cho "Nơi lưu trú": khách sạn, homestay, villa, resort... (URL gốc /<slug>-<id>.html) */
import { clean, parseNumber, parsePrice, splitAddress } from '../../lib/text';
import {
  collectImages,
  extractItemCategory,
  extractLabeledValues,
  ownText,
  paragraphTexts,
  type Doc,
} from '../../lib/html';
import { emptyTemplateResult, type TemplateResult } from '../types';

/** "Chưa cập nhật", "Đang cập nhật", "-" => null. */
export function cleanPlaceholder(value: string | null | undefined): string | null {
  const cleaned = clean(value);
  if (!cleaned) return null;
  if (/^(chưa cập nhật|đang cập nhật|đang cập nhật năm|chưa có|không có|n\/a|-+)$/i.test(cleaned)) return null;
  return cleaned;
}

export function parseAccommodation($: Doc, pageUrl: string): TemplateResult {
  const result = emptyTemplateResult();

  // ----- Tiêu đề -----
  result.title = ownText($, 'h1.text-black') ?? clean($('h1').first().text());

  // ----- Trạng thái xác thực -----
  const verifiedIcon = $('h1 i.fa-check-circle').first();
  if (verifiedIcon.length > 0) {
    const tooltip = verifiedIcon.attr('data-original-title') ?? '';
    result.contact.verified = !/chưa xác thực/i.test(tooltip);
    result.extras.verifiedLabel = clean(tooltip);
  }

  // ----- Danh mục -----
  result.category = extractItemCategory($, pageUrl);

  // ----- Khối thông tin: địa chỉ + giá -----
  const infoBlock = $('.article-info .w-100.size-1').first();
  const infoParagraphs = paragraphTexts($, infoBlock.length > 0 ? infoBlock : $('.article-info'));
  const addressRaw = infoParagraphs.find((p) => !/giá từ/i.test(p)) ?? null;
  const address = splitAddress(addressRaw);
  result.extras.address = address;

  const priceParagraph = $('p')
    .filter((_, el) => /giá từ/i.test($(el).text()))
    .first();
  if (priceParagraph.length > 0) {
    const raw =
      clean(priceParagraph.find('.text-danger').first().text()) ??
      clean(priceParagraph.clone().find('strong').last().text());
    const parsed = parsePrice(raw);
    result.price = { ...parsed, perM2Raw: null, perM2Value: null };
    result.extras.priceLabel = clean(priceParagraph.find('strong').first().text());
  }

  // ----- Ảnh -----
  result.images = collectImages($, pageUrl, [
    { selector: '#carouselProser img.gallery-img', role: 'gallery' },
    { selector: '#carouselProser .carousel-item img', role: 'gallery' },
    { selector: '#imageModal img#modalImage', role: 'gallery' },
    { selector: '#imageModal .thumbnail-bar img', role: 'gallery' },
    { selector: '.owl-carousel-images img', role: 'gallery' },
    { selector: '.article-media img', role: 'gallery' },
  ]);
  const ogImage = clean($('meta[property="og:image"]').attr('content'));
  if (ogImage) {
    const absolute = new URL(ogImage, pageUrl).toString();
    if (!result.images.some((image) => image.url === absolute) && /\.(jpe?g|png|webp|gif)$/i.test(absolute)) {
      result.images.unshift({ url: absolute, role: 'hero' });
    } else {
      const existing = result.images.find((image) => image.url === absolute);
      if (existing) existing.role = 'hero';
    }
  }

  // ----- Người quản lý -----
  const managerBlock = $('.box-info-main').first();
  if (managerBlock.length > 0) {
    const managerText = clean(managerBlock.text()) ?? '';
    result.contact.hasManager = !/chưa có người quản lý/i.test(managerText);
    result.extras.managerNotice = managerText;
  }

  // ----- Thông tin liên hệ trong modal người dùng -----
  const userModal = $('#userModal').first();
  if (userModal.length > 0) {
    result.contact.name = cleanPlaceholder(userModal.find('.text-primary.size-12').first().text());
    const labeled = extractLabeledValues($, '#userModal');
    result.contact.phone = cleanPlaceholder(labeled['Điện thoại'] ?? null);
    result.contact.email = cleanPlaceholder(labeled['Email'] ?? null);
    result.contact.certificate = cleanPlaceholder(labeled['Số chứng chỉ'] ?? null);
    result.contact.experience = cleanPlaceholder(labeled['Kinh nghiệm'] ?? null);
    const zaloHref = userModal.find('a[href*="zalo.me"]').first().attr('href');
    if (zaloHref) {
      const match = zaloHref.match(/zalo\.me\/([^/?#]+)/i);
      result.contact.zalo = cleanPlaceholder(match?.[1] ? decodeURIComponent(match[1]) : null);
    }
    result.extras.contactRaw = labeled;
  }

  if (!result.title) result.warnings.push('Không tìm thấy tiêu đề (h1)');
  if (!result.category) result.warnings.push('Không xác định được danh mục');
  if (result.images.length === 0) result.warnings.push('Không có ảnh');

  void parseNumber;
  return result;
}
