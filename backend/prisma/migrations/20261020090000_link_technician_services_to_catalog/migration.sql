ALTER TABLE "technician_services"
  ADD COLUMN "catalog_service_id" UUID;

UPDATE "technician_services" AS ts
SET "catalog_service_id" = sci."id"
FROM "service_catalog_items" AS sci
WHERE ts."catalog_service_id" IS NULL
  AND ts."category_id" = sci."category_id"
  AND LOWER(TRIM(ts."name")) = LOWER(TRIM(sci."name"));

CREATE INDEX "technician_services_catalog_service_id_idx"
  ON "technician_services"("catalog_service_id");

ALTER TABLE "technician_services"
  ADD CONSTRAINT "technician_services_catalog_service_id_fkey"
  FOREIGN KEY ("catalog_service_id") REFERENCES "service_catalog_items"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
