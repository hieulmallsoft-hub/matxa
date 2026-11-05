ALTER TABLE "bookings" ADD COLUMN "travel_fee" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "bookings" ADD COLUMN "travel_distance_km" DECIMAL(7,1);
