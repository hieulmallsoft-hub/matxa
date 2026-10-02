-- CreateEnum
CREATE TYPE "BookingAssignmentMode" AS ENUM ('DIRECT', 'OPEN_MARKETPLACE');

-- CreateEnum
CREATE TYPE "BookingTechnicianApplicationStatus" AS ENUM ('APPLIED', 'SELECTED', 'NOT_SELECTED', 'WITHDRAWN', 'DECLINED', 'EXPIRED');

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'OPEN';

-- DropForeignKey
ALTER TABLE "booking_items" DROP CONSTRAINT "booking_items_service_id_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_technician_id_fkey";

-- AlterTable
ALTER TABLE "booking_items" ADD COLUMN     "catalog_service_id" UUID,
ALTER COLUMN "service_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "application_deadline_at" TIMESTAMP(3),
ADD COLUMN     "assignment_mode" "BookingAssignmentMode" NOT NULL DEFAULT 'DIRECT',
ALTER COLUMN "technician_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "service_catalog_items" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration_minutes" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "modes" "ServiceMode"[] DEFAULT ARRAY[]::"ServiceMode"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_technician_applications" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "technician_profile_id" UUID NOT NULL,
    "status" "BookingTechnicianApplicationStatus" NOT NULL,
    "applied_at" TIMESTAMP(3),
    "selected_at" TIMESTAMP(3),
    "withdrawn_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "expired_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booking_technician_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_catalog_items_category_id_is_active_idx" ON "service_catalog_items"("category_id", "is_active");

-- CreateIndex
CREATE INDEX "booking_technician_applications_booking_id_status_idx" ON "booking_technician_applications"("booking_id", "status");

-- CreateIndex
CREATE INDEX "booking_technician_applications_technician_profile_id_statu_idx" ON "booking_technician_applications"("technician_profile_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "booking_technician_applications_booking_id_technician_profi_key" ON "booking_technician_applications"("booking_id", "technician_profile_id");

-- CreateIndex
CREATE INDEX "booking_items_catalog_service_id_idx" ON "booking_items"("catalog_service_id");

-- CreateIndex
CREATE INDEX "bookings_assignment_mode_status_scheduled_start_idx" ON "bookings"("assignment_mode", "status", "scheduled_start");

-- AddForeignKey
ALTER TABLE "service_catalog_items" ADD CONSTRAINT "service_catalog_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technician_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "technician_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_catalog_service_id_fkey" FOREIGN KEY ("catalog_service_id") REFERENCES "service_catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_technician_applications" ADD CONSTRAINT "booking_technician_applications_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_technician_applications" ADD CONSTRAINT "booking_technician_applications_technician_profile_id_fkey" FOREIGN KEY ("technician_profile_id") REFERENCES "technician_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A legacy/direct booking can never become unassigned.  An OPEN marketplace
-- booking has no winner yet; every non-OPEN marketplace state must have one.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_assignment_invariant"
  CHECK (
    ("assignment_mode" = 'DIRECT' AND "technician_id" IS NOT NULL AND "status" <> 'OPEN')
    OR
    ("assignment_mode" = 'OPEN_MARKETPLACE' AND ("status" = 'OPEN' OR "technician_id" IS NOT NULL))
  );

-- Service-level serializable transactions select the winner. This independent
-- database invariant protects against a future code path creating two winners.
CREATE UNIQUE INDEX "booking_technician_applications_one_selected_per_booking"
  ON "booking_technician_applications" ("booking_id")
  WHERE "status" = 'SELECTED';
