CREATE TABLE "promotion_recipients" (
  "promotion_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "promotion_recipients_pkey" PRIMARY KEY ("promotion_id", "user_id"),
  CONSTRAINT "promotion_recipients_promotion_id_fkey" FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "promotion_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "promotion_recipients_user_id_idx" ON "promotion_recipients"("user_id");
