-- Online bookings: pay after a technician takes it, earnings paid out by the admin, refunds sent by hand.
ALTER TYPE "CancellationReasonCode" ADD VALUE 'PAYMENT_NOT_RECEIVED';

ALTER TABLE "bookings" ADD COLUMN "payment_deadline_at" TIMESTAMP(3);

ALTER TABLE "payments"
  ADD COLUMN "payer_bank_bin" TEXT,
  ADD COLUMN "payer_bank_name" TEXT,
  ADD COLUMN "payer_account_number" TEXT,
  ADD COLUMN "payer_account_name" TEXT;

ALTER TABLE "technician_profiles"
  ADD COLUMN "bank_bin" TEXT,
  ADD COLUMN "bank_name" TEXT,
  ADD COLUMN "bank_account_number" TEXT,
  ADD COLUMN "bank_account_name" TEXT;

CREATE TABLE "technician_payouts" (
    "id" UUID NOT NULL,
    "technician_user_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "bank_bin" TEXT,
    "bank_name" TEXT,
    "account_number" TEXT,
    "account_name" TEXT,
    "transfer_note" TEXT NOT NULL,
    "paid_by_id" UUID NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "technician_payouts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "technician_payouts_technician_user_id_paid_at_idx" ON "technician_payouts"("technician_user_id", "paid_at" DESC);

CREATE TABLE "technician_earnings" (
    "id" UUID NOT NULL,
    "technician_user_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "gross_amount" INTEGER NOT NULL,
    "commission" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "payout_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "technician_earnings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "technician_earnings_booking_id_key" ON "technician_earnings"("booking_id");
CREATE INDEX "technician_earnings_technician_user_id_payout_id_idx" ON "technician_earnings"("technician_user_id", "payout_id");
ALTER TABLE "technician_earnings" ADD CONSTRAINT "technician_earnings_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "technician_payouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "booking_refunds" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "paid_amount" INTEGER NOT NULL,
    "fee_amount" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "done_by_id" UUID,
    "done_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "booking_refunds_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "booking_refunds_booking_id_key" ON "booking_refunds"("booking_id");
CREATE INDEX "booking_refunds_status_created_at_idx" ON "booking_refunds"("status", "created_at");
