ALTER TABLE "payments"
  ADD COLUMN "provider_transaction_no" TEXT,
  ADD COLUMN "bank_code" TEXT,
  ADD COLUMN "bank_tran_no" TEXT,
  ADD COLUMN "response_code" TEXT,
  ADD COLUMN "expires_at" TIMESTAMP(3),
  ADD COLUMN "ipn_received_at" TIMESTAMP(3),
  ADD COLUMN "refund_ref" TEXT,
  ADD COLUMN "refunded_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "payments_provider_provider_ref_key"
  ON "payments"("provider", "provider_ref");
CREATE INDEX "payments_status_expires_at_idx"
  ON "payments"("status", "expires_at");
