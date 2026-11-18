-- The facility gets its own coordinates (picked on the map); latitude/longitude keep following the technician's
-- phone for travel distances. Existing values are not copied: nothing tells a real facility point from a phone fix.
ALTER TABLE "technician_profiles" ADD COLUMN "facility_latitude" DECIMAL(10,7), ADD COLUMN "facility_longitude" DECIMAL(10,7);
ALTER TABLE "technician_applications" ADD COLUMN "facility_latitude" DECIMAL(10,7), ADD COLUMN "facility_longitude" DECIMAL(10,7);

-- ONSITE bookings already taken keep the facility as it is now, so later profile edits no longer rewrite them.
UPDATE "bookings" b
SET "address_snapshot" = COALESCE(b."address_snapshot", '{}'::jsonb) || jsonb_build_object('facility', jsonb_build_object(
  'name', p."facility",
  'address', p."address",
  'city', p."city",
  'district', p."district",
  'latitude', NULL,
  'longitude', NULL
))
FROM "technician_profiles" p
WHERE b."technician_id" = p."id"
  AND b."mode" = 'ONSITE'
  AND (p."facility" IS NOT NULL OR p."address" IS NOT NULL)
  AND (b."address_snapshot" IS NULL OR NOT (b."address_snapshot" ? 'facility'));
