/**
 * PHẦN PORT TỪ `phuochai-scraper` (dự án crawl cũ) - giữ nguyên logic parse để
 * dữ liệu crawl mới có cùng cấu trúc với dữ liệu đã import.
 *
 * Chỉ thay đổi: bỏ phần đọc/ghi file + CLI + state, và bỏ đuôi `.js` trong import
 * để chạy trong NestJS (CommonJS).
 */
/**
 * Bước 3 - Parse: biến HTML thô thành `ScrapedItem` theo schema chuẩn.
 * Nhận diện template (nơi lưu trú / tin tức / bất động sản / trang tĩnh) rồi gọi parser tương ứng.
 */
import { clean } from '../lib/text';
import {
  extractBreadcrumb,
  extractContent,
  extractEmbeds,
  extractPageContacts,
  extractSeo,
  extractTables,
  extractTags,
  load,
  type Doc,
} from '../lib/html';
import { detailId, itemTypeOfDetail, slugOf } from '../lib/urls';
import type { ItemType, LocationInfo, ScrapedItem } from '../types';
import { parseAccommodation } from './templates/accommodation';
import { parseArticle } from './templates/article';
import { parseGenericPage } from './templates/genericPage';
import { parseRealEstate } from './templates/realEstate';
import type { TemplateResult } from './types';

const SECTION_LABELS: Record<ItemType, string> = {
  accommodation: 'Nơi lưu trú',
  news: 'Tin tức',
  real_estate: 'Bất động sản',
  page: 'Trang thông tin',
};

/** Nhận diện template: ưu tiên URL, sau đó tới dấu hiệu trong HTML. */
export function detectTemplate($: Doc, url: string): ItemType {
  const fromUrl = itemTypeOfDetail(url);
  if (fromUrl) {
    // Xác minh chéo: URL gốc nhưng có khối bất động sản thì vẫn là bất động sản.
    if (fromUrl === 'accommodation' && $('.property-info').length > 0) return 'real_estate';
    return fromUrl;
  }
  const body = $.root().text();
  if ($('.article-info').length > 0) return 'accommodation';
  if ($('.news-media').length > 0 || /Mã tin\s*:/i.test(body)) return 'news';
  if ($('.property-info').length > 0 || /Mức giá/.test(body)) return 'real_estate';
  return 'page';
}

function runTemplate(type: ItemType, $: Doc, url: string): TemplateResult {
  switch (type) {
    case 'accommodation':
      return parseAccommodation($, url);
    case 'news':
      return parseArticle($, url);
    case 'real_estate':
      return parseRealEstate($, url);
    default:
      return parseGenericPage($, url);
  }
}

function normalizeLocation(value: unknown): LocationInfo {
  const fallback: LocationInfo = { raw: null, ward: null, district: null, city: null, street: null };
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Partial<LocationInfo>;
  return {
    raw: clean(candidate.raw ?? null),
    ward: clean(candidate.ward ?? null),
    district: clean(candidate.district ?? null),
    city: clean(candidate.city ?? null),
    street: clean(candidate.street ?? null),
  };
}

/** Parse một trang item thành bản ghi chuẩn. */
export function parseItem(html: string, url: string, htmlHash: string): ScrapedItem {
  const $ = load(html);
  const type = detectTemplate($, url);
  const template = runTemplate(type, $, url);
  const seo = extractSeo($, url);
  const content = extractContent($);
  const sourceId = detailId(url);
  const slug = slugOf(url);
  const warnings = [...template.warnings];

  const contentText = content.text ?? null;
  const contentHtml = content.html ?? null;

  const breadcrumbParts = [
    SECTION_LABELS[type],
    ...extractBreadcrumb($),
    ...(template.category?.name ? [template.category.name] : []),
  ].filter((part, index, all) => !!part && all.indexOf(part) === index);

  if (!contentHtml && type !== 'accommodation') {
    warnings.push('Không có nội dung bài viết (content rỗng)');
  }
  if (!seo.description) warnings.push('Thiếu meta description');

  const summary = template.summary ?? seo.description ?? seo.ogDescription ?? null;

  return {
    id: `${type}:${sourceId ?? slug}`,
    type,
    sourceId,
    url,
    canonicalUrl: seo.canonical ?? url,
    slug,
    title: template.title ?? seo.ogTitle ?? seo.title ?? slug,
    seoTitle: seo.title,
    summary,
    contentHtml,
    contentText,
    contentLength: contentText?.length ?? 0,
    category: template.category,
    breadcrumb: breadcrumbParts,
    location: normalizeLocation(template.extras.address),
    price: template.price,
    property: template.property,
    contact: template.contact,
    code: template.code,
    views: template.views,
    tags: extractTags($),
    images: template.images,
    tables: extractTables($),
    embeds: extractEmbeds($, url),
    pageContacts: extractPageContacts($),
    seo,
    extras: template.extras,
    crawledAt: new Date().toISOString(),
    htmlHash,
    warnings,
  };
}
