CREATE TYPE "ConversationType" AS ENUM ('LEGACY', 'BOOKING', 'SUPPORT');
ALTER TABLE "conversations"
  ADD COLUMN "type" "ConversationType" NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN "support_customer_id" UUID;
UPDATE "conversations" SET "type" = 'BOOKING' WHERE "booking_id" IS NOT NULL;
CREATE UNIQUE INDEX "conversations_support_customer_id_key" ON "conversations"("support_customer_id");
CREATE INDEX "conversations_type_last_message_at_idx" ON "conversations"("type", "last_message_at" DESC);
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_support_customer_id_fkey"
  FOREIGN KEY ("support_customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "support_conversation_customer_check"
  CHECK (("type" = 'SUPPORT' AND "support_customer_id" IS NOT NULL AND "booking_id" IS NULL)
    OR ("type" <> 'SUPPORT' AND "support_customer_id" IS NULL));
