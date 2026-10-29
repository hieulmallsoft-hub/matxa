-- Preserve the customer's original choice separately from the final assignment.
ALTER TABLE "bookings" ADD COLUMN "requested_technician_id" UUID;

-- Only existing direct assignments have a known original recipient.
UPDATE "bookings"
SET "requested_technician_id" = "technician_id"
WHERE "assignment_mode" = 'DIRECT' AND "technician_id" IS NOT NULL;
