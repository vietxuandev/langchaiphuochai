import type { Metadata } from 'next';
import { UsersTable } from '@/components/admin/users-table';

export const metadata: Metadata = { title: 'Người dùng' };

export default function AdminUsersPage() {
  return <UsersTable />;
}
