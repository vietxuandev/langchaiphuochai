'use client';

import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { Role } from '@phuochai/shared';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-context';

interface PostAdminActionsProps {
  postId: string;
  authorId?: string | null;
}

/** Nút sửa bài cho admin/editor hoặc chính tác giả, hiện trên trang công khai. */
export function PostAdminActions({ postId, authorId }: PostAdminActionsProps) {
  const { user, hasRole } = useAuth();

  if (!user) return null;

  const canEdit = hasRole(Role.EDITOR) || user.id === authorId;
  if (!canEdit) return null;

  return (
    <div className="mb-4 flex justify-end">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/quan-tri/bai-viet/${postId}`}>
          <Pencil className="mr-2 h-4 w-4" /> Sửa bài
        </Link>
      </Button>
    </div>
  );
}
