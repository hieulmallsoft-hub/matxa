ALTER TABLE "addresses" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN "address_snapshot" JSONB;

-- Best available backfill: original historical edits cannot be recovered.
UPDATE "bookings" b SET "address_snapshot" = jsonb_build_object(
  'id', a.id, 'addressText', a.address, 'address', a.address,
  'latitude', a.latitude, 'longitude', a.longitude, 'label', a.label
) FROM "addresses" a WHERE b.address_id = a.id AND b.mode = 'HOME';

-- Repair pre-existing duplicate defaults before enforcing the invariant.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY updated_at DESC, id ASC) AS n
  FROM addresses WHERE is_default = true
)
UPDATE addresses SET is_default = false WHERE id IN (SELECT id FROM ranked WHERE n > 1);
CREATE UNIQUE INDEX "addresses_one_live_default_per_user"
ON "addresses" ("user_id") WHERE "is_default" = true AND "deleted_at" IS NULL;
