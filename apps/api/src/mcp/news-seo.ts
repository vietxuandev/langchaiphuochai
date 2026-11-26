import { normalizeToc } from '@phuochai/shared';

/**
 * Chuẩn hoá SEO/format cho bài NEWS đã có, không viết lại nội dung.
 *
 * Các thay đổi an toàn:
 * - Tạo lại mục lục chuẩn (ul>li, lồng H3 trong H2) từ heading, bỏ TOC cũ (kể cả TOC có name/style).
 * - Bổ sung id menuN cho H2/H3 còn thiếu; giữ id cũ nếu đã có.
 * - Bổ sung seoTitle nếu thiếu.
 * - Chuẩn hoá summary quá ngắn/quá dài.
 *
 * Không sửa nội dung đoạn văn, ảnh, link, heading text.
 */

export interface NewsSeoMetrics {
  hasToc: boolean;
  h2Count: number;
  h2WithId: number;
  summaryLength: number;
  seoTitleLength: number;
  contentLength: number;
}

export interface NewsSeoResult {
  html: string;
  seoTitle: string;
  summary: string;
  changes: string[];
  before: NewsSeoMetrics;
  after: NewsSeoMetrics;
}

function metrics(html: string, summary: string, seoTitle: string): NewsSeoMetrics {
  return {
    hasToc: /id=["']main-toc["']/i.test(html),
    h2Count: (html.match(/<h2\b/gi) ?? []).length,
    h2WithId: (html.match(/<h2[^>]*\bid=/gi) ?? []).length,
    summaryLength: summary.trim().length,
    seoTitleLength: seoTitle.trim().length,
    contentLength: html.length,
  };
}

function decodeBasic(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function textOnly(value: string): string {
  return decodeBasic(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function truncateAtWord(value: string, max: number, ellipsis = true): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const at = cut.lastIndexOf(' ');
  const result = (at > max * 0.65 ? cut.slice(0, at) : cut).trim();
  return ellipsis ? `${result}…` : result;
}

export function normalizeNewsSeo(html: string, title: string, currentSummary: string | null, currentSeoTitle: string | null): NewsSeoResult {
  const before = metrics(html, currentSummary ?? '', currentSeoTitle ?? '');
  const changes: string[] = [];

  const toc = normalizeToc(html);
  const body = toc.html;
  if (toc.changed) {
    changes.push(before.hasToc ? 'Chuẩn hoá mục lục' : toc.sections > 0 ? 'Thêm mục lục' : 'Bổ sung id cho heading');
  }

  let summary = (currentSummary ?? '').trim();
  if (!summary || summary.length < 80) {
    const firstParagraph = body.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '';
    const candidate = truncateAtWord(textOnly(firstParagraph), 155);
    if (candidate.length >= 80) {
      summary = candidate;
      changes.push('Bổ sung/rút gọn summary');
    }
  } else if (summary.length > 170) {
    summary = truncateAtWord(summary, 160);
    changes.push('Rút gọn summary > 170 ký tự');
  }

  let seoTitle = (currentSeoTitle ?? '').trim();
  if (!seoTitle) {
    seoTitle = truncateAtWord(title, 70, false);
    changes.push('Bổ sung seoTitle');
  } else if (seoTitle.length > 70) {
    seoTitle = truncateAtWord(seoTitle, 70, false);
    changes.push('Rút gọn seoTitle');
  }

  const after = metrics(body, summary, seoTitle);
  return { html: body, seoTitle, summary, changes: [...new Set(changes)], before, after };
}
