ALTER TYPE "CancellationReasonCode" ADD VALUE IF NOT EXISTS 'CUSTOMER_NO_SHOW';
ALTER TYPE "CancellationReasonCode" ADD VALUE IF NOT EXISTS 'UNSAFE_SITUATION';
ALTER TYPE "CancellationReasonCode" ADD VALUE IF NOT EXISTS 'INAPPROPRIATE_REQUEST';
ALTER TYPE "CancellationReasonCode" ADD VALUE IF NOT EXISTS 'SERVICE_LOCATION_UNAVAILABLE';
ALTER TYPE "CancellationReasonCode" ADD VALUE IF NOT EXISTS 'CUSTOMER_REQUESTED_CANCEL';

CREATE TABLE "booking_cancellations" (
  "id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "actor_role" "UserRole" NOT NULL,
  "reason_code" "CancellationReasonCode" NOT NULL,
  "reason_text" TEXT,
  "cancelled_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_cancellations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "booking_cancellation_evidence" (
  "id" UUID NOT NULL,
  "cancellation_id" UUID NOT NULL,
  "storage_key" TEXT NOT NULL,
  "media_type" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_cancellation_evidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "booking_cancellations_booking_id_key" ON "booking_cancellations"("booking_id");
CREATE INDEX "booking_cancellations_actor_user_id_created_at_idx" ON "booking_cancellations"("actor_user_id", "created_at" DESC);
CREATE UNIQUE INDEX "booking_cancellation_evidence_cancellation_id_storage_key_key" ON "booking_cancellation_evidence"("cancellation_id", "storage_key");

ALTER TABLE "booking_cancellations" ADD CONSTRAINT "booking_cancellations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_cancellations" ADD CONSTRAINT "booking_cancellations_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_cancellation_evidence" ADD CONSTRAINT "booking_cancellation_evidence_cancellation_id_fkey" FOREIGN KEY ("cancellation_id") REFERENCES "booking_cancellations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
