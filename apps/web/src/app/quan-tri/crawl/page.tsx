import type { Metadata } from 'next';
import { CrawlPanel } from '@/components/admin/crawl-panel';

export const metadata: Metadata = { title: 'Crawl bài mới' };

export default function AdminCrawlPage() {
  return <CrawlPanel />;
}
