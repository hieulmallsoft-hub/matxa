ALTER TYPE "ConversationType" ADD VALUE IF NOT EXISTS 'COMPLAINT';
ALTER TABLE "conversations" ADD COLUMN "complaint_id" UUID;
CREATE UNIQUE INDEX "conversations_complaint_id_key" ON "conversations"("complaint_id");
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_complaint_id_fkey"
  FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
