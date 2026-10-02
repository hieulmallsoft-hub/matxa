CREATE TYPE "ServiceCatalogPricingTemplate" AS ENUM ('STANDARD_60_90_120', 'FIXED_60', 'DATE_2_4_6_HOURS');

ALTER TABLE "booking_items"
  ADD COLUMN "catalog_price_option_id" UUID,
  ADD COLUMN "category_id" UUID,
  ADD COLUMN "category_name" TEXT;

-- Existing catalog rows are preserved and receive deterministic legacy slugs.
ALTER TABLE "service_catalog_items" ADD COLUMN "slug" TEXT;
UPDATE "service_catalog_items" SET "slug" = 'legacy-' || "id"::text WHERE "slug" IS NULL;
ALTER TABLE "service_catalog_items"
  ALTER COLUMN "slug" SET NOT NULL,
  ADD COLUMN "pricing_template" "ServiceCatalogPricingTemplate" NOT NULL DEFAULT 'FIXED_60',
  ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "service_catalog_price_options" (
  "id" UUID NOT NULL,
  "catalog_service_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "duration_minutes" INTEGER NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "service_catalog_price_options_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_catalog_items_slug_key" ON "service_catalog_items"("slug");
CREATE INDEX "service_catalog_items_category_id_is_active_sort_order_idx" ON "service_catalog_items"("category_id", "is_active", "sort_order");
CREATE UNIQUE INDEX "service_catalog_price_options_catalog_service_id_code_key" ON "service_catalog_price_options"("catalog_service_id", "code");
CREATE INDEX "service_catalog_price_options_catalog_service_id_is_active__idx" ON "service_catalog_price_options"("catalog_service_id", "is_active", "sort_order");
CREATE INDEX "booking_items_catalog_price_option_id_idx" ON "booking_items"("catalog_price_option_id");

ALTER TABLE "service_catalog_price_options" ADD CONSTRAINT "service_catalog_price_options_catalog_service_id_fkey" FOREIGN KEY ("catalog_service_id") REFERENCES "service_catalog_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_catalog_price_option_id_fkey" FOREIGN KEY ("catalog_price_option_id") REFERENCES "service_catalog_price_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
