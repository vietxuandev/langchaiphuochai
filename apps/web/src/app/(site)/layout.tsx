import { JsonLd } from '@/components/seo/json-ld';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { ZaloFloatButton } from '@/components/site/zalo-float-button';
import { getNavCategories } from '@/lib/data/categories';
import { siteJsonLd } from '@/lib/seo/structured-data';

// Khung công khai được cache/ISR; dữ liệu menu/footer lấy trong lúc build
// qua API_BUILD_URL và được làm mới theo chu kỳ bên dưới.
export const revalidate = 300;

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const categories = await getNavCategories();

  return (
    <div className="flex min-h-screen flex-col">
      <JsonLd id="jsonld-site" data={siteJsonLd()} />
      <SiteHeader categories={categories} />
      <main className="flex-1">{children}</main>
      <SiteFooter categories={categories} />
      <ZaloFloatButton />
    </div>
  );
}
