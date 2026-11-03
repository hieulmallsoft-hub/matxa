-- A customer may cancel an open booking before choosing a technician, so an
-- OPEN_MARKETPLACE booking can end CANCELLED without technician_id.
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_assignment_invariant";

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_assignment_invariant"
  CHECK (
    ("assignment_mode" = 'DIRECT' AND "technician_id" IS NOT NULL AND "status" <> 'OPEN')
    OR
    ("assignment_mode" = 'OPEN_MARKETPLACE' AND ("status" IN ('OPEN', 'EXPIRED', 'CANCELLED') OR "technician_id" IS NOT NULL))
  );
