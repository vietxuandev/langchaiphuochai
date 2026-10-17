import type { Metadata } from 'next';
import { CategoriesTable } from '@/components/admin/categories-table';

export const metadata: Metadata = { title: 'Danh mục' };

export default function AdminCategoriesPage() {
  return <CategoriesTable />;
}
