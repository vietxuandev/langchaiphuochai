'use client';

import { getToken } from '@/lib/auth/token';

export interface AffiliateLink {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  merchant: string;
  destinationUrl: string;
  imagePath: string | null;
  priceText: string | null;
  campaign: string | null;
  subId: string | null;
  isActive: boolean;
  clicks: number;
  lastClickedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateLinkInput {
  slug: string;
  title: string;
  description?: string;
  merchant?: string;
  destinationUrl: string;
  imagePath?: string;
  priceText?: string;
  campaign?: string;
  subId?: string;
  isActive?: boolean;
}

export interface AffiliateMetadataResult {
  ok: boolean;
  code?: string;
  source?: 'html' | 'openapi';
  finalUrl?: string;
  itemId?: string | null;
  shopId?: string | null;
  title?: string | null;
  description?: string | null;
  imagePath?: string | null;
  priceText?: string | null;
  message?: string;
}

export interface AffiliateStats {
  totalLinks: number;
  activeLinks: number;
  inactiveLinks: number;
  totalClicks: number;
  clicksToday: number;
  clicks7d: number;
  noClickLinks: number;
  missingImageLinks: number;
  health: { inactive: number; noClicks: number; missingImage: number };
  topLinks: Array<{ id: string; slug: string; title: string; clicks: number }>;
  recentClicks: Array<{
    id: string;
    postSlug: string | null;
    referrer: string | null;
    createdAt: string;
    link: { slug: string; title: string };
  }>;
  clickTrend: Array<{ date: string; count: number }>;
}

export interface AffiliateList {
  items: AffiliateLink[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) return data.message.join('; ');
    if (typeof data.message === 'string') return data.message;
  } catch {
    // Body không phải JSON.
  }
  if (response.status === 401) return 'Bạn cần đăng nhập';
  if (response.status === 403) return 'Bạn không có quyền quản lý affiliate';
  return `Yêu cầu thất bại (HTTP ${response.status})`;
}

function authHeaders(): HeadersInit | undefined {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export async function fetchAffiliateLinks(params: {
  query?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<AffiliateList> {
  const search = new URLSearchParams();
  if (params.query) search.set('query', params.query);
  if (typeof params.active === 'boolean') search.set('active', String(params.active));
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));

  const response = await fetch(`/api/affiliate?${search.toString()}`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as AffiliateList;
}

export async function fetchAffiliateMetadata(url: string): Promise<AffiliateMetadataResult> {
  const response = await fetch('/api/affiliate/metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authHeaders() ?? {}) },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as AffiliateMetadataResult;
}

export async function fetchAffiliateStats(): Promise<AffiliateStats> {
  const response = await fetch('/api/affiliate/stats', { headers: authHeaders(), cache: 'no-store' });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as AffiliateStats;
}

export async function createAffiliateLink(input: AffiliateLinkInput): Promise<AffiliateLink> {
  const response = await fetch('/api/affiliate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(authHeaders() ?? {}) },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as AffiliateLink;
}

export async function updateAffiliateLink(id: string, input: Partial<AffiliateLinkInput>): Promise<AffiliateLink> {
  const response = await fetch(`/api/affiliate/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(authHeaders() ?? {}) },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as AffiliateLink;
}

export async function deleteAffiliateLink(id: string): Promise<boolean> {
  const response = await fetch(`/api/affiliate/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!response.ok) throw new Error(await readError(response));
  return true;
}
