import type { Metadata } from 'next';
import { FacebookQueuePanel } from '@/components/admin/facebook-queue-panel';

export const metadata: Metadata = { title: 'Tự đăng Facebook' };

export default function AdminFacebookPage() {
  return <FacebookQueuePanel />;
}
