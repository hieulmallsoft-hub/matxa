-- Profile photos and certificates, reviewed by an admin before customers see them.
CREATE TYPE "TechnicianPhotoKind" AS ENUM ('GALLERY', 'CERTIFICATE');
CREATE TYPE "TechnicianPhotoStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
ALTER TABLE "technician_application_gallery"
  ADD COLUMN "kind" "TechnicianPhotoKind" NOT NULL DEFAULT 'GALLERY',
  ADD COLUMN "status" "TechnicianPhotoStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "rejection_reason" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMP(3);
-- Photos of applications approved before this change were approved with them.
UPDATE "technician_application_gallery" g SET "status" = 'APPROVED', "reviewed_at" = a."approved_at"
FROM "technician_applications" a WHERE a."id" = g."application_id" AND a."status" = 'APPROVED';
CREATE INDEX "technician_application_gallery_status_created_at_idx" ON "technician_application_gallery"("status", "created_at");
