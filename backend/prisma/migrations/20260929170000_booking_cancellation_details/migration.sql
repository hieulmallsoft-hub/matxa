CREATE TYPE "CancellationReasonCode" AS ENUM ('NO_LONGER_NEEDED', 'SERVICE_ISSUE', 'PAYMENT_REFUND_ISSUE', 'OTHER');

ALTER TABLE "bookings"
  ADD COLUMN "cancellation_reason_code" "CancellationReasonCode",
  ADD COLUMN "cancellation_reason_text" TEXT,
  ADD COLUMN "cancelled_by_user_id" UUID,
  ADD COLUMN "cancelled_by_role" "UserRole";

CREATE INDEX "bookings_cancelled_by_user_id_idx" ON "bookings"("cancelled_by_user_id");
