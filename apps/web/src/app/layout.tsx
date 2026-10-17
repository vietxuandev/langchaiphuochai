import type { Metadata, Viewport } from 'next';
import { BRAND } from '@phuochai/shared';
import { Providers } from './providers';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? BRAND.siteUrl;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${BRAND.name} - ${BRAND.tagline}`,
    template: `%s | ${BRAND.name}`,
  },
  description: `Danh bạ lưu trú và cẩm nang du lịch Phước Hải: khách sạn, homestay, villa, điểm đến, ăn uống và kinh nghiệm cho chuyến đi của bạn. Hotline ${BRAND.phoneDisplay}.`,
  keywords: [
    'Làng Chài Phước Hải',
    'du lịch Phước Hải',
    'homestay Phước Hải',
    'khách sạn Phước Hải',
    'bất động sản Phước Hải',
    BRAND.domain,
  ],
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: BRAND.name,
    title: `${BRAND.name} - ${BRAND.tagline}`,
    description: 'Khám phá nơi lưu trú, điểm đến và ẩm thực Phước Hải.',
    url: siteUrl,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#14807f',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
