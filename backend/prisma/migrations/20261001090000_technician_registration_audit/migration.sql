-- Expand the application workflow without changing existing approved records.
ALTER TYPE "TechnicianApplicationStatus" RENAME TO "TechnicianApplicationStatus_old";
CREATE TYPE "TechnicianApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');
ALTER TABLE "technician_applications" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "technician_applications"
  ALTER COLUMN "status" TYPE "TechnicianApplicationStatus"
  USING (CASE WHEN "status"::text = 'PENDING' THEN 'SUBMITTED'::"TechnicianApplicationStatus" ELSE "status"::text::"TechnicianApplicationStatus" END);
ALTER TABLE "technician_applications" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
DROP TYPE "TechnicianApplicationStatus_old";

ALTER TABLE "technician_applications"
  ADD COLUMN "application_type" TEXT,
  ADD COLUMN "district" TEXT,
  ADD COLUMN "facility" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "submitted_at" TIMESTAMP(3),
  ADD COLUMN "under_review_at" TIMESTAMP(3),
  ADD COLUMN "approved_at" TIMESTAMP(3),
  ADD COLUMN "rejected_at" TIMESTAMP(3),
  ADD COLUMN "supported_modes" "ServiceMode"[] NOT NULL DEFAULT ARRAY[]::"ServiceMode"[];

ALTER TABLE "technician_profiles"
  ADD COLUMN "district" TEXT,
  ADD COLUMN "facility" TEXT;

CREATE TYPE "TechnicianKycStatus" AS ENUM ('NOT_STARTED', 'ID_UPLOADED', 'FACE_UPLOADED', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');
CREATE TYPE "TechnicianKycDocumentType" AS ENUM ('ID_CARD_FRONT', 'ID_CARD_BACK', 'FACE_IMAGE');

CREATE TABLE "technician_kyc" (
  "id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "status" "TechnicianKycStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "rejection_reason" TEXT,
  "reviewed_by" UUID,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "technician_kyc_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "technician_kyc_application_id_key" ON "technician_kyc"("application_id");
ALTER TABLE "technician_kyc" ADD CONSTRAINT "technician_kyc_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "technician_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "technician_kyc_documents" (
  "id" UUID NOT NULL,
  "kyc_id" UUID NOT NULL,
  "type" "TechnicianKycDocumentType" NOT NULL,
  "storage_key" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "file_size" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "technician_kyc_documents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "technician_kyc_documents_kyc_id_type_key" ON "technician_kyc_documents"("kyc_id", "type");
ALTER TABLE "technician_kyc_documents" ADD CONSTRAINT "technician_kyc_documents_kyc_id_fkey" FOREIGN KEY ("kyc_id") REFERENCES "technician_kyc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "technician_application_gallery" (
  "id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "storage_key" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "technician_application_gallery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "technician_application_gallery_application_id_sort_order_idx" ON "technician_application_gallery"("application_id", "sort_order");
ALTER TABLE "technician_application_gallery" ADD CONSTRAINT "technician_application_gallery_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "technician_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "technician_service_price_options" (
  "id" UUID NOT NULL,
  "technician_service_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "duration_minutes" INTEGER NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "technician_service_price_options_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "technician_service_price_options_service_code_key" ON "technician_service_price_options"("technician_service_id", "code");
CREATE INDEX "technician_service_price_options_service_active_idx" ON "technician_service_price_options"("technician_service_id", "is_active");
ALTER TABLE "technician_service_price_options" ADD CONSTRAINT "technician_service_price_options_service_fkey" FOREIGN KEY ("technician_service_id") REFERENCES "technician_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "booking_items"
  ADD COLUMN "price_option_id" UUID,
  ADD COLUMN "price_option_code" TEXT;
