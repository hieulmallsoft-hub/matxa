CREATE TYPE "ComplaintReasonCode" AS ENUM ('SERVICE_ISSUE', 'TECHNICIAN_NO_CONTACT', 'TECHNICIAN_BEHAVIOR', 'SAFETY_ISSUE', 'PAYMENT_ISSUE', 'OTHER');
CREATE TYPE "ComplaintStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

CREATE TABLE "complaints" (
  "id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "reason_code" "ComplaintReasonCode" NOT NULL,
  "detail" TEXT NOT NULL,
  "contact_email" TEXT NOT NULL,
  "status" "ComplaintStatus" NOT NULL DEFAULT 'SUBMITTED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "complaint_evidence" (
  "id" UUID NOT NULL,
  "complaint_id" UUID NOT NULL,
  "storage_key" TEXT NOT NULL,
  "media_type" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "complaint_evidence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "complaints_booking_id_key" ON "complaints"("booking_id");
CREATE INDEX "complaints_customer_id_created_at_idx" ON "complaints"("customer_id", "created_at" DESC);
CREATE INDEX "complaints_status_created_at_idx" ON "complaints"("status", "created_at" DESC);
CREATE UNIQUE INDEX "complaint_evidence_complaint_id_storage_key_key" ON "complaint_evidence"("complaint_id", "storage_key");
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "complaint_evidence" ADD CONSTRAINT "complaint_evidence_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
