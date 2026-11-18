'use client';

import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { Role } from '@phuochai/shared';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-context';

interface PostAdminActionsProps {
  postId: string;
  authorId?: string | null;
  /** Bài chưa có nội dung chi tiết: nhắc người có quyền sửa bổ sung (khách không thấy). */
  missingContent?: boolean;
}

/** Nút sửa bài cho admin/editor hoặc chính tác giả, hiện trên trang công khai. */
export function PostAdminActions({ postId, authorId, missingContent = false }: PostAdminActionsProps) {
  const { user, hasRole } = useAuth();

  if (!user) return null;

  const canEdit = hasRole(Role.EDITOR) || user.id === authorId;
  if (!canEdit) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
      {missingContent ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Bài chưa có nội dung chi tiết - khách chỉ thấy phần tóm tắt và nút liên hệ.
        </p>
      ) : null}
      <Button variant="outline" size="sm" asChild>
        <Link href={`/quan-tri/bai-viet/${postId}`}>
          <Pencil className="mr-2 h-4 w-4" /> {missingContent ? 'Bổ sung nội dung' : 'Sửa bài'}
        </Link>
      </Button>
    </div>
  );
}
