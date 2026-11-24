interface AffiliateCard {
  slug: string;
  title: string;
  description: string | null;
  merchant: string;
  imagePath: string | null;
  priceText: string | null;
}

const apiBaseUrl =
  process.env.API_BUILD_URL || process.env.API_INTERNAL_URL || 'http://localhost:4000';

function escapeHtml(value: string | null | undefined): string {
  return (value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function fetchCard(slug: string): Promise<AffiliateCard | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/api/affiliate/public/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) return null;
    return (await response.json()) as AffiliateCard;
  } catch {
    return null;
  }
}

function cardHtml(card: AffiliateCard, postSlug: string): string {
  const image = card.imagePath
    ? `<div class="affiliate-card__media"><img src="${escapeHtml(card.imagePath)}" alt="${escapeHtml(card.title)}" loading="lazy" /></div>`
    : '';
  const description = card.description
    ? `<p class="affiliate-card__description">${escapeHtml(card.description)}</p>`
    : '';
  const price = card.priceText
    ? `<span class="affiliate-card__price">${escapeHtml(card.priceText)}</span>`
    : '';

  return `<aside class="affiliate-card not-prose" aria-label="Sản phẩm gợi ý">
  ${image}
  <div class="affiliate-card__body">
    <p class="affiliate-card__eyebrow">Gợi ý từ Làng Chài</p>
    <p class="affiliate-card__title">${escapeHtml(card.title)}</p>
    ${description}
    <div class="affiliate-card__footer">
      ${price}
      <a class="affiliate-card__cta" href="/go/${encodeURIComponent(card.slug)}?from=${encodeURIComponent(postSlug)}" target="_blank" rel="sponsored nofollow noopener noreferrer">
        Xem trên ${escapeHtml(card.merchant === 'SHOPEE' ? 'Shopee' : card.merchant)}
      </a>
    </div>
  </div>
</aside>`;
}

/**
 * Thay shortcode [[affiliate:slug]] bằng thẻ sản phẩm HTML.
 * Nội dung lấy từ endpoint public, không lộ URL đích.
 */
export async function renderAffiliateShortcodes(
  contentHtml: string,
  postSlug: string,
): Promise<{ html: string; hasAffiliate: boolean }> {
  const pattern = /\[\[affiliate:([a-z0-9-]+)\]\]/gi;
  const matches = [...contentHtml.matchAll(pattern)];
  const hasGoLink = /href="\/go\//.test(contentHtml) || /https?:\/\/(?:[\w-]+\.)?(?:shopee\.vn|shope\.ee)/i.test(contentHtml);
  if (matches.length === 0) return { html: contentHtml, hasAffiliate: hasGoLink };

  const slugs = [...new Set(matches.map((match) => match[1].toLowerCase()))];
  const cards = new Map<string, AffiliateCard | null>();
  await Promise.all(
    slugs.map(async (slug) => {
      cards.set(slug, await fetchCard(slug));
    }),
  );

  const renderCard = (rawSlug: string) => {
    const card = cards.get(rawSlug.toLowerCase());
    return card ? cardHtml(card, postSlug) : '';
  };

  // Shortcode thường được editor bọc trong <p>; thay cả <p> để tránh <aside> nằm trong <p>.
  const withBlocks = contentHtml.replace(
    /<p>\s*\[\[affiliate:([a-z0-9-]+)\]\]\s*<\/p>/gi,
    (_match, rawSlug: string) => renderCard(rawSlug),
  );
  const html = withBlocks.replace(pattern, (_match, rawSlug: string) => renderCard(rawSlug));

  return { html, hasAffiliate: true };
}
