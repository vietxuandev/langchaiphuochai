/**
 * PHẦN PORT TỪ `phuochai-scraper` (dự án crawl cũ) - giữ nguyên logic parse để
 * dữ liệu crawl mới có cùng cấu trúc với dữ liệu đã import.
 *
 * Chỉ thay đổi: bỏ phần đọc/ghi file + CLI + state, và bỏ đuôi `.js` trong import
 * để chạy trong NestJS (CommonJS).
 */
/** Kiểu dữ liệu nội bộ của bước parse. */
import type { CategoryRef, ContactInfo, MediaRef, PriceInfo, PropertyDetails } from '../types';

export interface TemplateResult {
  title: string | null;
  summary: string | null;
  category: CategoryRef | null;
  code: string | null;
  views: number | null;
  price: PriceInfo | null;
  property: PropertyDetails | null;
  contact: ContactInfo;
  images: MediaRef[];
  extras: Record<string, unknown>;
  warnings: string[];
}

export function emptyContact(): ContactInfo {
  return {
    name: null,
    phone: null,
    email: null,
    zalo: null,
    certificate: null,
    experience: null,
    verified: null,
    hasManager: null,
  };
}

export function emptyTemplateResult(): TemplateResult {
  return {
    title: null,
    summary: null,
    category: null,
    code: null,
    views: null,
    price: null,
    property: null,
    contact: emptyContact(),
    images: [],
    extras: {},
    warnings: [],
  };
}
