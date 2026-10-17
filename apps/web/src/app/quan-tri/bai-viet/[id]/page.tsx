'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { PostForm } from '@/components/admin/post-form';
import { useAdminPostDetailQuery } from '@/generated/graphql';

/** Trang chỉnh sửa bài viết: tải dữ liệu theo id rồi đổ vào form. */
export default function AdminEditPostPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';

  const { data, loading, error } = useAdminPostDetailQuery({
    variables: { id },
    skip: !id,
    fetchPolicy: 'network-only',
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Skeleton className="h-[520px] rounded-xl" />
          <Skeleton className="h-[320px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data?.postById) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/quan-tri/bai-viet">
            <ArrowLeft className="mr-2 h-4 w-4" /> Về danh sách bài viết
          </Link>
        </Button>
        <EmptyState
          icon={FileQuestion}
          title="Không tìm thấy bài viết"
          description="Bài viết có thể đã bị xoá hoặc bạn không có quyền truy cập."
          action={
            <Button asChild>
              <Link href="/quan-tri/bai-viet">Về danh sách</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return <PostForm mode="edit" post={data.postById} />;
}
