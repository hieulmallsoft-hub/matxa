-- An OPEN marketplace booking may expire without a selected technician.
-- Keep the invariant for all other terminal states while allowing this
-- intentional unassigned terminal state.
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_assignment_invariant";

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_assignment_invariant"
  CHECK (
    ("assignment_mode" = 'DIRECT' AND "technician_id" IS NOT NULL AND "status" <> 'OPEN')
    OR
    ("assignment_mode" = 'OPEN_MARKETPLACE' AND ("status" IN ('OPEN', 'EXPIRED') OR "technician_id" IS NOT NULL))
  );
