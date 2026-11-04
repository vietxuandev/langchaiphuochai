import { BRAND, buildImageUrl, formatAddress } from '@phuochai/shared';
import type { PostFullFragment } from '@/generated/graphql';

/**
 * URL công khai của site.
 *
 * Hiện tại lấy từ `NEXT_PUBLIC_SITE_URL` (giống metadata/canonical).
 * Khi chạy multi-domain, đổi helper này sang đọc Host từ `headers()`.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? BRAND.siteUrl).replace(/\/$/, '');

const ORGANIZATION_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;
const LOGO_URL = `${SITE_URL}/icons/logo-mark.png`;

const SECTION_CONFIG: Record<string, { label: string; path: string }> = {
  ACCOMMODATION: { label: 'Nơi lưu trú', path: '/luu-tru' },
  NEWS: { label: 'Tin tức & cẩm nang', path: '/tin-tuc' },
  REAL_ESTATE: { label: 'Bất động sản', path: '/bat-dong-san' },
};

type JsonLdObject = Record<string, unknown>;

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface CategorySeoInput {
  name: string;
  slug: string;
  description?: string | null;
  section: string;
  parent?: { name: string; slug: string } | null;
}

interface PostListSeoInput {
  slug: string;
  title: string;
}

/** Chuyển path tương đối thành URL tuyệt đối; giữ nguyên URL ngoài. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path.startsWith('/') ? path : `/${path}`, `${SITE_URL}/`).toString();
}

/** Đường dẫn công khai của một bài viết theo loại nội dung. */
export function postPath(post: Pick<PostFullFragment, 'type' | 'slug'>): string {
  switch (post.type) {
    case 'ACCOMMODATION':
      return `/luu-tru/${post.slug}`;
    case 'NEWS':
      return `/tin-tuc/${post.slug}`;
    case 'REAL_ESTATE':
      return `/bat-dong-san/${post.slug}`;
    default:
      return `/trang/${post.slug}`;
  }
}

function isoDate(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function descriptionFor(post: Pick<PostFullFragment, 'summary' | 'contentText'>): string {
  const text = post.summary?.trim() || post.contentText?.replace(/\s+/g, ' ').trim();
  return (text || BRAND.tagline).slice(0, 300);
}

function imageUrls(post: Pick<PostFullFragment, 'heroImage' | 'images'>): string[] {
  const paths = [post.heroImage?.path, ...post.images.map((image) => image.path)].filter(
    (path): path is string => Boolean(path),
  );
  return [...new Set(paths)]
    .map((path) => absoluteUrl(buildImageUrl({ path })))
    .slice(0, 12);
}

function postalAddress(
  post: Pick<PostFullFragment, 'addressRaw' | 'ward' | 'city'>,
): JsonLdObject {
  return {
    '@type': 'PostalAddress',
    ...(post.addressRaw ? { streetAddress: post.addressRaw } : {}),
    addressLocality: post.ward ?? 'Phước Hải',
    addressRegion: post.city ?? 'TP. Hồ Chí Minh',
    addressCountry: 'VN',
  };
}

function zaloUrl(post: Pick<PostFullFragment, 'contactZalo'>): string | undefined {
  if (!post.contactZalo) return undefined;
  if (/^https?:\/\//i.test(post.contactZalo)) return post.contactZalo;
  const digits = post.contactZalo.replace(/\D/g, '');
  return digits ? `https://zalo.me/${digits}` : undefined;
}

function offerFor(
  post: Pick<PostFullFragment, 'priceValue' | 'priceUnit'>,
  url: string,
): JsonLdObject | undefined {
  if (post.priceValue == null) return undefined;
  const price = Number(post.priceValue);
  if (!Number.isFinite(price) || price <= 0) return undefined;

  return {
    '@type': 'Offer',
    price,
    priceCurrency: 'VND',
    availability: 'https://schema.org/InStock',
    url,
  };
}

function propertyValues(post: PostFullFragment): JsonLdObject[] {
  const entries: Array<[string, unknown]> = [
    [
      'Địa chỉ',
      formatAddress({ addressRaw: post.addressRaw, ward: post.ward, city: post.city }),
    ],
    ['Diện tích', post.areaM2 ? `${post.areaM2} m²` : post.areaText],
    ['Số phòng ngủ', post.bedrooms],
    ['Số phòng tắm', post.bathrooms],
    ['Hướng', post.direction],
    ['Pháp lý', post.legal],
    ['Số tầng', post.floors],
    ['Đường rộng', post.roadWidth],
    ['Kích thước', post.dimensions],
    ['Giá/m²', post.pricePerM2Raw],
  ];

  return entries
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    .map(([name, value]) => ({
      '@type': 'PropertyValue',
      name,
      value: String(value),
    }));
}

function breadcrumbList(items: BreadcrumbItem[]): JsonLdObject {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  };
}

function postBreadcrumbs(
  post: Pick<PostFullFragment, 'type' | 'slug' | 'title' | 'category'>,
  urlPath?: string,
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [{ name: 'Trang chủ', url: '/' }];
  const section = SECTION_CONFIG[post.type];

  if (section) items.push({ name: section.label, url: section.path });
  if (post.category) {
    items.push({ name: post.category.name, url: `/danh-muc/${post.category.slug}` });
  }
  items.push({ name: post.title, url: urlPath ?? postPath(post) });

  return items;
}

function postMainSchema(post: PostFullFragment, urlPath?: string): JsonLdObject {
  const url = absoluteUrl(urlPath ?? postPath(post));
  const description = descriptionFor(post);
  const images = imageUrls(post);
  const offer = offerFor(post, url);
  const zalo = zaloUrl(post);
  const common = {
    name: post.title,
    description,
    url,
    ...(images.length ? { image: images } : {}),
    isPartOf: { '@id': WEBSITE_ID },
  };

  switch (post.type) {
    case 'ACCOMMODATION':
      return {
        '@type': 'LodgingBusiness',
        '@id': `${url}#lodging`,
        ...common,
        address: postalAddress(post),
        telephone: post.contactPhone ?? BRAND.phone,
        email: post.contactEmail ?? BRAND.email,
        ...(post.priceRaw ? { priceRange: post.priceRaw } : {}),
        ...(offer ? { makesOffer: offer } : {}),
        ...(zalo ? { sameAs: [zalo] } : {}),
      };

    case 'NEWS':
      return {
        '@type': 'Article',
        '@id': `${url}#article`,
        ...common,
        headline: post.title,
        datePublished: isoDate(post.publishedAt ?? post.createdAt),
        dateModified: isoDate(post.updatedAt),
        author: post.author
          ? { '@type': 'Person', name: post.author.name }
          : { '@type': 'Organization', '@id': ORGANIZATION_ID, name: BRAND.name },
        publisher: {
          '@type': 'Organization',
          '@id': ORGANIZATION_ID,
          name: BRAND.name,
          logo: { '@type': 'ImageObject', url: LOGO_URL },
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        ...(post.category ? { articleSection: post.category.name } : {}),
        ...(post.tags.length || post.tagsText.length
          ? {
              keywords: post.tags.length
                ? post.tags.map((tag) => tag.name)
                : post.tagsText,
            }
          : {}),
        inLanguage: 'vi-VN',
        isAccessibleForFree: true,
      };

    case 'REAL_ESTATE': {
      const additionalProperty = propertyValues(post);
      return {
        '@type': 'Product',
        '@id': `${url}#product`,
        ...common,
        category: 'Bất động sản',
        ...(offer ? { offers: offer } : {}),
        ...(additionalProperty.length ? { additionalProperty } : {}),
      };
    }

    default:
      return {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        ...common,
        inLanguage: 'vi-VN',
      };
  }
}

/** JSON-LD cho một bài viết: schema chính + breadcrumb. */
export function postJsonLd(post: PostFullFragment, urlPath?: string): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      postMainSchema(post, urlPath),
      breadcrumbList(postBreadcrumbs(post, urlPath)),
    ],
  };
}

/** JSON-LD sitewide: Organization + WebSite (kèm SearchAction). */
export function siteJsonLd(): JsonLdObject {
  const sameAs = [
    BRAND.facebook,
    BRAND.zalo ? `https://zalo.me/${BRAND.zalo}` : undefined,
  ].filter((value): value is string => Boolean(value));

  const organization = {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: BRAND.name,
    url: SITE_URL,
    description: BRAND.tagline,
    email: BRAND.email,
    telephone: BRAND.phone,
    logo: {
      '@type': 'ImageObject',
      url: LOGO_URL,
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: BRAND.address,
      addressLocality: 'Phước Hải',
      addressRegion: 'TP. Hồ Chí Minh',
      addressCountry: 'VN',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: BRAND.phone,
      contactType: 'customer service',
      areaServed: 'Phước Hải',
      availableLanguage: ['vi'],
    },
    ...(sameAs.length ? { sameAs } : {}),
  };

  const website = {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE_URL,
    name: BRAND.name,
    description: BRAND.tagline,
    inLanguage: 'vi-VN',
    publisher: { '@id': ORGANIZATION_ID },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/tim-kiem?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [organization, website],
  };
}

/** JSON-LD cho trang danh mục: CollectionPage + ItemList + breadcrumb. */
export function categoryJsonLd(
  category: CategorySeoInput,
  posts: PostListSeoInput[],
): JsonLdObject {
  const url = absoluteUrl(`/danh-muc/${category.slug}`);
  const sectionPath = SECTION_CONFIG[category.section]?.path ?? '/trang';

  const breadcrumbs: BreadcrumbItem[] = [{ name: 'Trang chủ', url: '/' }];
  if (category.parent) {
    breadcrumbs.push({
      name: category.parent.name,
      url: `/danh-muc/${category.parent.slug}`,
    });
  }
  breadcrumbs.push({ name: category.name, url: `/danh-muc/${category.slug}` });

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': `${url}#collection`,
        name: category.name,
        ...(category.description ? { description: category.description } : {}),
        url,
        isPartOf: { '@id': WEBSITE_ID },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: posts.length,
          itemListElement: posts.map((post, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: post.title,
            url: absoluteUrl(`${sectionPath}/${post.slug}`),
          })),
        },
      },
      breadcrumbList(breadcrumbs),
    ],
  };
}
