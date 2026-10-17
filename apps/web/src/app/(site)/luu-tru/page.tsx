import type { Metadata } from 'next';
import { PostType } from '@phuochai/shared';
import { ListingPage } from '@/components/site/listing-page';

export const metadata: Metadata = {
  title: 'Nơi lưu trú tại Phước Hải - Khách sạn, homestay, villa',
  description:
    'Danh sách khách sạn, homestay, villa, resort và nhà nghỉ tại Phước Hải kèm giá, vị trí và hình ảnh thực tế.',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Danh sách nơi lưu trú có bộ lọc theo danh mục, khu vực, khoảng giá. */
export default async function AccommodationListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <ListingPage
      type={PostType.ACCOMMODATION}
      eyebrow="Nơi lưu trú"
      title="Khách sạn, homestay & villa tại Phước Hải"
      description="Tổng hợp nơi lưu trú với mức giá, địa chỉ và hình ảnh được kế thừa từ dữ liệu gốc, giúp bạn chọn chỗ nghỉ phù hợp."
      searchParams={params}
    />
  );
}
