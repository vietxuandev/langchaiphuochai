import type { Metadata } from 'next';
import { AdminNotificationsPage } from '@/components/admin/admin-notifications-page';

export const metadata: Metadata = { title: 'Thông báo' };

export default function AdminNotificationsRoute() {
  return <AdminNotificationsPage />;
}
