import type { Metadata } from 'next';
import { MediaLibrary } from '@/components/admin/media-library';

export const metadata: Metadata = { title: 'Thư viện ảnh' };

export default function AdminMediaPage() {
  return <MediaLibrary />;
}
