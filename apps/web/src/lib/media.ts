'use client';

import { getToken } from '@/lib/auth/token';

export interface MediaUsage {
  posts: number;
  categories: number;
  users: number;
  total: number;
}

export interface MediaItem {
  path: string;
  filename: string;
  folder: string;
  bytes: number;
  modifiedAt: string;
  usage: MediaUsage;
}

export interface MediaPage {
  items: MediaItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  totalBytes: number;
  totalFiles: number;
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
  if (response.status === 403) return 'Bạn không có quyền quản lý media';
  return `Yêu cầu thất bại (HTTP ${response.status})`;
}

export async function fetchMedia(params: {
  query?: string;
  folder?: string;
  page?: number;
  pageSize?: number;
}): Promise<MediaPage> {
  const token = getToken();
  const search = new URLSearchParams();
  if (params.query) search.set('query', params.query);
  if (params.folder && params.folder !== 'all') search.set('folder', params.folder);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));

  const response = await fetch(`/api/media?${search.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(await readError(response));
  return (await response.json()) as MediaPage;
}

export async function deleteMedia(path: string): Promise<boolean> {
  const token = getToken();
  const response = await fetch(`/api/media?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) throw new Error(await readError(response));
  return true;
}
