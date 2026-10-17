import type { Metadata } from 'next';
import { PostType } from '@phuochai/shared';
import { ListingPage } from '@/components/site/listing-page';

export const metadata: Metadata = {
  title: 'Bất động sản Phước Hải - Nhà đất, villa ven biển',
  description: 'Danh sách bất động sản tại Phước Hải: đất nền, nhà phố, villa biển với giá, diện tích và pháp lý.',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RealEstateListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <ListingPage
      type={PostType.REAL_ESTATE}
      eyebrow="Bất động sản"
      title="Nhà đất & bất động sản nghỉ dưỡng Phước Hải"
      description="Thông tin mức giá, diện tích, hướng, pháp lý của từng sản phẩm - dữ liệu đã được chuẩn hoá để tra cứu nhanh."
      searchParams={params}
    />
  );
}
