-- Technicians can complain too: one complaint per booking per side.
ALTER TYPE "ComplaintReasonCode" ADD VALUE 'CUSTOMER_NO_SHOW';
ALTER TYPE "ComplaintReasonCode" ADD VALUE 'CUSTOMER_BEHAVIOR';
ALTER TABLE "complaints" ADD COLUMN "reporter_role" "UserRole" NOT NULL DEFAULT 'CUSTOMER';
DROP INDEX "complaints_booking_id_key";
CREATE UNIQUE INDEX "complaints_booking_id_reporter_role_key" ON "complaints"("booking_id", "reporter_role");
