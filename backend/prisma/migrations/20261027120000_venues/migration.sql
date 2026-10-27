CREATE TABLE "venues" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "address" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "district" TEXT,
  "latitude" DECIMAL(10,7) NOT NULL,
  "longitude" DECIMAL(10,7) NOT NULL,
  "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
  "review_count" INTEGER NOT NULL DEFAULT 0,
  "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "venues_is_active_city_district_idx" ON "venues"("is_active", "city", "district");
CREATE TABLE "venue_services" (
  "id" UUID NOT NULL, "venue_id" UUID NOT NULL, "catalog_service_id" UUID, "name" TEXT NOT NULL,
  "duration_minutes" INTEGER NOT NULL, "price" DECIMAL(12,2) NOT NULL, "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT "venue_services_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "venue_services_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "venue_services_venue_id_is_active_idx" ON "venue_services"("venue_id", "is_active");
CREATE TABLE "venue_opening_hours" (
  "id" UUID NOT NULL, "venue_id" UUID NOT NULL, "day_of_week" INTEGER NOT NULL, "open_time" TEXT,
  "close_time" TEXT, "is_closed" BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT "venue_opening_hours_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "venue_opening_hours_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "venue_opening_hours_venue_id_day_of_week_key" ON "venue_opening_hours"("venue_id", "day_of_week");
