CREATE TYPE "TechnicianApplicationStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "technician_applications" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "TechnicianApplicationStatus" NOT NULL DEFAULT 'DRAFT',
  "display_name" TEXT,
  "gender" "Gender",
  "city" TEXT,
  "bio" TEXT,
  "id_card_front_key" TEXT,
  "id_card_back_key" TEXT,
  "face_image_key" TEXT,
  "rejection_reason" TEXT,
  "reviewed_by" UUID,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "technician_applications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "technician_applications_user_id_key" ON "technician_applications"("user_id");
CREATE INDEX "technician_applications_status_created_at_idx" ON "technician_applications"("status", "created_at" DESC);
ALTER TABLE "technician_applications" ADD CONSTRAINT "technician_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
