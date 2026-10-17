import type { Metadata } from 'next';
import { PostForm } from '@/components/admin/post-form';

export const metadata: Metadata = { title: 'Thêm bài viết' };

export default function AdminCreatePostPage() {
  return <PostForm mode="create" />;
}
