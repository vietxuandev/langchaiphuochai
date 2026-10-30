/**
 * PHẦN PORT TỪ `phuochai-scraper` (dự án crawl cũ) - giữ nguyên logic parse để
 * dữ liệu crawl mới có cùng cấu trúc với dữ liệu đã import.
 *
 * Chỉ thay đổi: bỏ phần đọc/ghi file + CLI + state, và bỏ đuôi `.js` trong import
 * để chạy trong NestJS (CommonJS).
 */
/** Helper bọc cheerio: trích xuất meta, nội dung, bảng, ảnh, liên hệ... */
import * as cheerio from 'cheerio';
import type { Cheerio, CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';
import { absolutize, normalizeUrl } from './urls';
import { clean } from './text';
import type { CategoryRef, MediaRef, MediaRole, SeoMeta, TableBlock } from '../types';

export type Doc = CheerioAPI;

export function load(html: string): Doc {
  return cheerio.load(html);
}

/** Lấy text đã chuẩn hoá của selector đầu tiên. */
export function text($: Doc, selector: string, root?: Cheerio<AnyNode>): string | null {
  const el = root ? root.find(selector).first() : $(selector).first();
  return clean(el.text());
}

/** Lấy text của tất cả các selector (đã dedupe, bỏ rỗng). */
export function texts($: Doc, selector: string, root?: Cheerio<AnyNode>): string[] {
  const scope = root ?? $.root();
  const out: string[] = [];
  scope.find(selector).each((_, el) => {
    const value = clean($(el).text());
    if (value) out.push(value);
  });
  return [...new Set(out)];
}

export function attr($: Doc, selector: string, name: string, root?: Cheerio<AnyNode>): string | null {
  const el = root ? root.find(selector).first() : $(selector).first();
  return clean(el.attr(name));
}

/** Text "riêng" của một element, bỏ qua text của các thẻ con bị loại (ví dụ icon `<i>`). */
export function ownText($: Doc, selector: string, exclude = 'i, span.tooltip, svg'): string | null {
  const el = $(selector).first();
  if (el.length === 0) return null;
  const clone = el.clone();
  clone.find(exclude).remove();
  return clean(clone.text());
}

/** Meta SEO của trang. */
export function extractSeo($: Doc, pageUrl: string): SeoMeta {
  const meta = (name: string): string | null => {
    const byName = $(`meta[name="${name}"]`).attr('content');
    const byProperty = $(`meta[property="${name}"]`).attr('content');
    return clean(byName ?? byProperty ?? null);
  };

  return {
    title: clean($('title').first().text()),
    description: meta('description'),
    keywords: meta('keywords'),
    robots: meta('robots'),
    canonical: absolutize($('link[rel="canonical"]').attr('href') ?? '', pageUrl),
    ogTitle: meta('og:title'),
    ogDescription: meta('og:description'),
    ogImage: absolutize(meta('og:image') ?? '', pageUrl),
    ogType: meta('og:type'),
    ogSiteName: meta('og:site_name'),
  };
}

/**
 * Trích nội dung bài viết chính.
 * `contentHtml` giữ nguyên HTML gốc, `contentText` là text thuần (đã bỏ mục lục tự động).
 */
export function extractContent($: Doc): { html: string | null; text: string | null } {
  const candidates = ['.box-detail.post-content', '.post-content', '.box-detail', '.box-projcet-content'];
  let element: Cheerio<AnyNode> | null = null;
  for (const selector of candidates) {
    const found = $(selector).first();
    if (found.length > 0 && clean(found.text())) {
      element = found;
      break;
    }
  }
  if (!element) return { html: null, text: null };

  const htmlClone = element.clone();
  htmlClone.find('script, style, noscript').remove();
  const html = (htmlClone.html() ?? '').trim() || null;

  const textClone = element.clone();
  textClone.find('[name="tableOfContents"], script, style, noscript').remove();
  const plain = clean(textClone.text());

  return { html, text: plain };
}

/** Trích tất cả bảng trong nội dung thành cấu trúc header/rows. */
export function extractTables($: Doc, rootSelector = '.post-content, .box-detail'): TableBlock[] {
  const tables: TableBlock[] = [];
  const roots = $(rootSelector);
  const searchRoot: Cheerio<AnyNode> = roots.length > 0 ? roots : $.root();
  searchRoot.find('table').each((_, table) => {
    const $table = $(table);
    const headers: string[] = [];
    const rows: string[][] = [];
    $table.find('tr').each((__, tr) => {
      const cells: string[] = [];
      $(tr)
        .find('th, td')
        .each((___, cell) => {
          cells.push(clean($(cell).text()) ?? '');
        });
      if (cells.length === 0) return;
      if ($(tr).find('th').length > 0 && headers.length === 0) headers.push(...cells);
      else rows.push(cells);
    });
    if (rows.length > 0 || headers.length > 0) {
      tables.push({ caption: clean($table.find('caption').text()), headers, rows });
    }
  });
  return tables;
}

const IGNORED_IMAGE_RE = /noimage|\/frontend\/images\/|registration\.|favion|\/logo|logo\./i;

/** Gom ảnh theo vùng chỉ định, trả về MediaRef đã dedupe theo URL. */
export function collectImages(
  $: Doc,
  pageUrl: string,
  specs: { selector: string; role: MediaRole }[],
): MediaRef[] {
  const seen = new Map<string, MediaRef>();
  for (const { selector, role } of specs) {
    $(selector).each((_, el) => {
      const raw = $(el).attr('src') ?? $(el).attr('data-src') ?? $(el).attr('data-lazy-src');
      const url = raw ? absolutize(raw, pageUrl) : null;
      if (!url) return;
      const path = new URL(url).pathname;
      if (IGNORED_IMAGE_RE.test(path) && role !== 'logo') return;
      if (seen.has(url)) return;
      seen.set(url, { url, role, alt: clean($(el).attr('alt')) });
    });
  }
  return [...seen.values()];
}

/** Danh sách iframe nhúng (Google Maps, YouTube...). */
export function extractEmbeds($: Doc, pageUrl: string): string[] {
  const out: string[] = [];
  $('iframe').each((_, el) => {
    const src = $(el).attr('src');
    const url = src ? absolutize(src, pageUrl) : null;
    if (url) out.push(url);
  });
  return [...new Set(out)];
}

/** Liên hệ xuất hiện trong trang (tel:, mailto:, zalo.me). */
export function extractPageContacts($: Doc): { phones: string[]; emails: string[]; zalo: string[] } {
  const phones = new Set<string>();
  const emails = new Set<string>();
  const zalo = new Set<string>();

  /** Bỏ các giá trị placeholder như "Chưa cập nhật". */
  const isPlaceholder = (value: string): boolean =>
    /^(chưa|đang)\s*cập nhật$/i.test(value) || value.trim().length === 0;

  const addPhone = (value: string | null): void => {
    const raw = (value ?? '').trim();
    if (isPlaceholder(raw)) return;
    const digits = raw.replace(/[^\d+]/g, '');
    if (digits.replace(/\D/g, '').length >= 9) phones.add(digits);
  };

  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') ?? '').trim();
    const lower = href.toLowerCase();
    if (lower.startsWith('tel:')) addPhone(href.slice(4));
    else if (lower.startsWith('mailto:')) {
      const value = clean(href.slice(7).split('?')[0] ?? '');
      if (value && value.includes('@')) emails.add(value);
    } else if (/zalo\.me\//i.test(href)) {
      const match = href.match(/zalo\.me\/([^/?#]+)/i);
      const value = clean(match?.[1] ? decodeURIComponent(match[1]) : null);
      if (value) zalo.add(value);
    }
  });

  // Số điện thoại dạng text ở khu vực liên hệ/footer.
  const bodyText = $.root().text();
  for (const match of bodyText.matchAll(/(?:Điện thoại|Hotline|Phone|Zalo)\s*:?\s*((?:\+?84|0)[\d.\s-]{7,14})/gi)) {
    addPhone(match[1] ?? null);
  }
  return { phones: [...phones], emails: [...emails], zalo: [...zalo] };
}

/** Breadcrumb: các link trong `.box-title` (trang danh mục) hoặc tiêu đề danh mục. */
export function extractBreadcrumb($: Doc): string[] {
  const parts: string[] = [];
  const boxTitle = $('.box-title').first();
  if (boxTitle.length > 0) {
    boxTitle.find('a').each((_, el) => {
      const value = clean($(el).text());
      if (value) parts.push(value);
    });
    if (parts.length === 0) {
      const value = clean(boxTitle.text());
      if (value) parts.push(value);
    }
  }
  if (parts.length === 0) {
    const generic = $('.breadcrumb a, nav[aria-label="breadcrumb"] a');
    generic.each((_, el) => {
      const value = clean($(el).text());
      if (value && !/^trang chủ$/i.test(value)) parts.push(value);
    });
  }
  return [...new Set(parts)];
}

/** Tag bài viết: các link `/tags/...`. */
export function extractTags($: Doc): string[] {
  const tags = new Set<string>();
  $('a[href*="/tags/"]').each((_, el) => {
    const value = clean($(el).text());
    if (value) tags.add(value);
  });
  return [...tags];
}

/** Text "Hiện có 160 điểm lưu trú" -> 160. */
export function extractDeclaredCount($: Doc): number | null {
  const body = $.root().text();
  const match = body.match(/Hiện có\s*([\d.,]+)\s*(?:điểm lưu trú|tin|bài|kết quả)/i);
  if (!match?.[1]) return null;
  const value = Number.parseInt(match[1].replace(/[.,]/g, ''), 10);
  return Number.isFinite(value) ? value : null;
}

/**
 * Số lượng công bố của từng danh mục trên menu (thẻ `<span class="badge">` cạnh link danh mục).
 * Trả về map: URL danh mục -> số lượng.
 */
export function extractCategoryCounts($: Doc, pageUrl: string): Record<string, number> {
  const counts: Record<string, number> = {};
  $('a[href]').each((_, el) => {
    const badge = $(el).find('span.badge').first();
    if (badge.length === 0) return;
    const url = absolutize($(el).attr('href') ?? '', pageUrl);
    if (!url) return;
    const value = Number.parseInt((clean(badge.text()) ?? '').replace(/[^\d]/g, ''), 10);
    if (Number.isFinite(value)) counts[url] = value;
  });
  return counts;
}

/** Chuẩn hoá CategoryRef từ URL danh mục + tên hiển thị. */
export function toCategoryRef(url: string, name: string | null): CategoryRef {  const path = new URL(url).pathname;
  const file = path.split('/').filter(Boolean).pop() ?? path;
  const idMatch = file.match(/-(\d+)\.html?$/);
  return {
    name: name ?? file.replace(/\.html?$/, ''),
    url,
    slug: file.replace(/\.html?$/, '').replace(/-\d+$/, ''),
    id: idMatch?.[1] ? Number.parseInt(idMatch[1], 10) : null,
  };
}

/**
 * Danh mục của một item: link danh mục nằm trong `.article-info` (nơi lưu trú),
 * ngay trước `<h1>` (tin tức) hoặc trước `<h2>` (bất động sản).
 */
export function extractItemCategory($: Doc, pageUrl: string): CategoryRef | null {
  const anchors: Cheerio<AnyNode>[] = [];
  const inArticle = $('.article-info > a').first();
  if (inArticle.length > 0) anchors.push(inArticle);
  const beforeH1 = $('h1').first().prevAll('a').first();
  if (beforeH1.length > 0) anchors.push(beforeH1);
  const beforeH2 = $('h2').first().prevAll('a').first();
  if (beforeH2.length > 0) anchors.push(beforeH2);
  $('p a[href*="/bat-dong-san/"], p a[href*="/tin-tuc/"], p a[href*="/noi-luu-tru/"]').each((_, el) => {
    anchors.push($(el));
  });

  for (const anchor of anchors) {
    const href = anchor.attr('href');
    const url = href ? absolutize(href, pageUrl) : null;
    if (!url) continue;
    const path = new URL(url).pathname;
    if (!/^\/(noi-luu-tru|tin-tuc|bat-dong-san)\//.test(path)) continue;
    return toCategoryRef(url, clean(anchor.text()));
  }
  return null;
}

/** Ảnh đại diện: og:image trước, sau đó ảnh đầu tiên trong các vùng media. */
export function heroImage($: Doc, pageUrl: string): MediaRef | null {
  const ogUrl = absolutize($('meta[property="og:image"]').attr('content') ?? '', pageUrl);
  const candidates = [
    ogUrl,
    absolutize($('#carouselProser img.gallery-img').first().attr('src') ?? '', pageUrl),
    absolutize($('.news-media img').first().attr('src') ?? '', pageUrl),
    absolutize($('.owl-carousel-images img').first().attr('src') ?? '', pageUrl),
    absolutize($('.box-image img').first().attr('src') ?? '', pageUrl),
  ].filter((value): value is string => !!value && /\.(jpe?g|png|webp|gif)$/i.test(new URL(value).pathname));

  const first = candidates[0];
  return first ? { url: normalizeUrl(first, pageUrl) ?? first, role: 'hero' } : null;
}

/** Text của các `<p>` trong một container, đã bỏ rỗng. */
export function paragraphTexts($: Doc, root: Cheerio<AnyNode>): string[] {
  const out: string[] = [];
  root.find('p').each((_, el) => {
    const value = clean($(el).text());
    if (value) out.push(value);
  });
  return out;
}

/** Đọc các cặp "nhãn: giá trị" từ một container dạng `<strong>Nhãn: </strong>Giá trị`. */
export function extractLabeledValues($: Doc, selector: string): Record<string, string> {
  const result: Record<string, string> = {};
  $(selector)
    .find('p, .form-group, li')
    .each((_, el) => {
      const $el = $(el);
      const label = clean($el.find('strong').first().text());
      if (!label || !label.endsWith(':')) return;
      const full = clean($el.text()) ?? '';
      const value = clean(full.slice(label.length));
      if (value) result[label.replace(/:$/, '').trim()] = value;
    });
  return result;
}
