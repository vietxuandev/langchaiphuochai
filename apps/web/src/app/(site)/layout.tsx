import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { getNavCategories } from '@/lib/data/categories';

// Dữ liệu luôn lấy mới từ API (trang danh bạ cần nội dung cập nhật liên tục).
export const dynamic = 'force-dynamic';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const categories = await getNavCategories();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader categories={categories} />
      <main className="flex-1">{children}</main>
      <SiteFooter categories={categories} />
    </div>
  );
}
