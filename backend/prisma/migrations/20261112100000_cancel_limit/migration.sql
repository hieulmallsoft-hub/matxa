-- Cancel limit: categories opt in (default on), bookings remember whether their cancel counted.
ALTER TABLE "service_categories" ADD COLUMN "counts_cancellations" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "bookings" ADD COLUMN "cancel_penalized" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "bookings_cancelled_by_user_id_cancelled_at_idx" ON "bookings"("cancelled_by_user_id", "cancelled_at");
