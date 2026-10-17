import type { Metadata } from 'next';
import { AccountSettings } from '@/components/admin/account-settings';

export const metadata: Metadata = { title: 'Tài khoản' };

export default function AdminAccountPage() {
  return <AccountSettings />;
}
