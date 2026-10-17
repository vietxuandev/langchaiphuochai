import type { Metadata } from 'next';
import { ListingPage } from '@/components/site/listing-page';

export const metadata: Metadata = {
  title: 'Tìm kiếm',
  description: 'Tìm kiếm nơi lưu trú, bài viết và bất động sản tại Phước Hải theo tên, nội dung hoặc thẻ.',
  robots: { index: false, follow: true },
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Tìm kiếm toàn bộ nội dung theo từ khoá. */
export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const keyword = Array.isArray(params.q) ? params.q[0] : params.q;

  return (
    <ListingPage
      eyebrow="Tìm kiếm"
      title={keyword ? `Kết quả cho “${keyword}”` : 'Tìm kiếm trên Phước Hải'}
      description={
        keyword
          ? 'Kết quả được lọc theo tiêu đề, mô tả, nội dung bài viết và thẻ.'
          : 'Nhập từ khoá ở thanh tìm kiếm phía trên để tra cứu nơi lưu trú, bài viết và bất động sản.'
      }
      searchParams={params}
      keyword={keyword}
      pageSize={12}
    />
  );
}
