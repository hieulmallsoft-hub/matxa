ALTER TABLE "technician_applications" ADD COLUMN "id_card_number" TEXT;

CREATE TYPE "TechnicianContractStatus" AS ENUM ('DRAFT', 'SIGNED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

CREATE TABLE "technician_contracts" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "contract_number" TEXT NOT NULL,
  "template_version" TEXT NOT NULL,
  "status" "TechnicianContractStatus" NOT NULL DEFAULT 'DRAFT',
  "contract_data" JSONB NOT NULL,
  "signature_key" TEXT,
  "signed_document_key" TEXT,
  "signed_at" TIMESTAMP(3),
  "reviewed_by" UUID,
  "reviewed_at" TIMESTAMP(3),
  "rejection_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "technician_contracts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "technician_contracts_user_id_key" ON "technician_contracts"("user_id");
CREATE UNIQUE INDEX "technician_contracts_application_id_key" ON "technician_contracts"("application_id");
CREATE UNIQUE INDEX "technician_contracts_contract_number_key" ON "technician_contracts"("contract_number");
CREATE INDEX "technician_contracts_status_created_at_idx" ON "technician_contracts"("status", "created_at" DESC);
ALTER TABLE "technician_contracts" ADD CONSTRAINT "technician_contracts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "technician_contracts" ADD CONSTRAINT "technician_contracts_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "technician_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
