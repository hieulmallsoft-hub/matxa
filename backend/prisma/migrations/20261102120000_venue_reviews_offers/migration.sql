ALTER TABLE "promotions"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "terms" TEXT,
  ADD COLUMN "note" TEXT;

ALTER TABLE "venues"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "is_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "promotion_id" UUID;
ALTER TABLE "venues" ADD CONSTRAINT "venues_promotion_id_fkey"
  FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "venues_promotion_id_idx" ON "venues"("promotion_id");

CREATE TABLE "venue_reviews" (
  "id" UUID NOT NULL,
  "venue_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "is_hidden" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "venue_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "venue_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);
CREATE UNIQUE INDEX "venue_reviews_venue_id_user_id_key" ON "venue_reviews"("venue_id", "user_id");
CREATE INDEX "venue_reviews_venue_id_is_hidden_created_at_idx" ON "venue_reviews"("venue_id", "is_hidden", "created_at" DESC);
ALTER TABLE "venue_reviews" ADD CONSTRAINT "venue_reviews_venue_id_fkey"
  FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "venue_reviews" ADD CONSTRAINT "venue_reviews_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Training venues are dropped from the product; hide existing ones rather than delete data.
UPDATE "venues" SET "is_active" = false WHERE "category" = 'TRAINING';
