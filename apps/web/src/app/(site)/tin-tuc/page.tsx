import type { Metadata } from 'next';
import { PostType } from '@phuochai/shared';
import { ListingPage } from '@/components/site/listing-page';

export const metadata: Metadata = {
  title: 'Tin tức & cẩm nang du lịch Phước Hải',
  description: 'Kinh nghiệm ăn uống, điểm tham quan, di chuyển và lưu trú tại Phước Hải.',
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewsListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <ListingPage
      type={PostType.NEWS}
      eyebrow="Cẩm nang du lịch"
      title="Tin tức & kinh nghiệm du lịch Phước Hải"
      description="Ăn gì, đi đâu, ở đâu và những kinh nghiệm thực tế được tổng hợp cho chuyến đi của bạn."
      searchParams={params}
      pageSize={9}
    />
  );
}
