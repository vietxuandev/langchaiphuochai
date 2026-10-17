'use client';

import { getToken } from '@/lib/auth/token';

export interface UploadResult {
  /** Đường dẫn public trên server mới, ví dụ "/upload/posts/2026/10/anh-1a2b3c4d.jpg" */
  path: string;
  bytes: number;
  mimeType: string;
  originalName: string;
}

export type UploadFolder = 'posts' | 'categories' | 'avatars';

/** Thông báo lỗi trả về từ API upload. */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) return data.message.join('; ');
    if (typeof data.message === 'string') return data.message;
  } catch {
    // Bỏ qua: body không phải JSON
  }
  if (response.status === 401) return 'Bạn cần đăng nhập để tải ảnh lên';
  if (response.status === 413) return 'Ảnh vượt quá dung lượng cho phép';
  return `Tải ảnh thất bại (HTTP ${response.status})`;
}

/**
 * Tải một ảnh lên server mới (POST /api/upload).
 * Ảnh được lưu vào thư mục `upload/<folder>/<năm>/<tháng>/` và trả về đường dẫn public.
 */
export async function uploadImage(file: File, folder: UploadFolder = 'posts'): Promise<UploadResult> {
  const token = getToken();
  const form = new FormData();
  form.append('file', file);

  const response = await fetch(`/api/upload?folder=${folder}`, {
    method: 'POST',
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as UploadResult;
}

/** Xoá ảnh đã upload khỏi server (chỉ admin/editor). */
export async function deleteUploadedImage(path: string): Promise<boolean> {
  const token = getToken();
  const response = await fetch(`/api/upload?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return true;
}
