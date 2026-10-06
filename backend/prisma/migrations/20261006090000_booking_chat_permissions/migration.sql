-- Preserve existing legacy conversations while allowing a customer and KTV
-- to have a separate thread for every booking.
ALTER TABLE "conversations"
  ADD COLUMN "booking_id" UUID,
  ADD COLUMN "customer_id" UUID,
  ADD COLUMN "technician_user_id" UUID;

ALTER TABLE "conversations"
  DROP CONSTRAINT IF EXISTS "conversations_participant_key_key";

CREATE UNIQUE INDEX "conversations_booking_id_key" ON "conversations"("booking_id");
CREATE INDEX "conversations_participant_key_idx" ON "conversations"("participant_key");
CREATE INDEX "conversations_customer_id_technician_user_id_idx" ON "conversations"("customer_id", "technician_user_id");

ALTER TABLE "conversations"
  ADD CONSTRAINT "conversations_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "conversations_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "conversations_technician_user_id_fkey"
    FOREIGN KEY ("technician_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
