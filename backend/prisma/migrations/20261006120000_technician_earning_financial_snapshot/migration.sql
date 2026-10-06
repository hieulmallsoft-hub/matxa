ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "gross_service_amount" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "platform_fee" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "technician_earning" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "customer_payable_amount" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "fee_policy_version" TEXT;

-- Legacy bookings intentionally remain NULL. Never infer historical earnings.
