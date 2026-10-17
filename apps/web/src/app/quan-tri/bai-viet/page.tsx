import type { Metadata } from 'next';
import { PostsTable } from '@/components/admin/posts-table';

export const metadata: Metadata = { title: 'Bài viết' };

export default function AdminPostsPage() {
  return <PostsTable />;
}
