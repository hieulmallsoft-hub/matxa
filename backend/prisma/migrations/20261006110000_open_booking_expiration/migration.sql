ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "expired_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "bookings_assignment_mode_status_application_deadline_at_idx"
  ON "bookings"("assignment_mode", "status", "application_deadline_at");
