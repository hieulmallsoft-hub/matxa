ALTER TABLE "technician_profiles" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "technician_profiles_is_active_is_available_average_rating_id_idx"
ON "technician_profiles" ("is_active", "is_available" DESC, "average_rating" DESC, "id");
CREATE INDEX "technician_profiles_tags_idx" ON "technician_profiles" USING GIN ("tags");
