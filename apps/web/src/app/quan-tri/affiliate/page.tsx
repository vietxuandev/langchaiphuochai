import type { Metadata } from 'next';
import { AffiliateManager } from '@/components/admin/affiliate-manager';

export const metadata: Metadata = { title: 'Affiliate Shopee' };

export default function AdminAffiliatePage() {
  return <AffiliateManager />;
}
