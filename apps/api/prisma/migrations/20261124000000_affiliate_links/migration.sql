-- Link affiliate Shopee được quản lý tập trung.
CREATE TABLE "affiliate_links" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "merchant" TEXT NOT NULL DEFAULT 'SHOPEE',
    "destinationUrl" TEXT NOT NULL,
    "imagePath" TEXT,
    "priceText" TEXT,
    "campaign" TEXT,
    "subId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "lastClickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "affiliate_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "affiliate_links_slug_key" ON "affiliate_links"("slug");
CREATE INDEX "affiliate_links_isActive_idx" ON "affiliate_links"("isActive");
CREATE INDEX "affiliate_links_clicks_idx" ON "affiliate_links"("clicks");

CREATE TABLE "affiliate_clicks" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "postSlug" TEXT,
    "referrer" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "affiliate_clicks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "affiliate_clicks_linkId_createdAt_idx" ON "affiliate_clicks"("linkId", "createdAt");
CREATE INDEX "affiliate_clicks_createdAt_idx" ON "affiliate_clicks"("createdAt");
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_linkId_fkey"
  FOREIGN KEY ("linkId") REFERENCES "affiliate_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
