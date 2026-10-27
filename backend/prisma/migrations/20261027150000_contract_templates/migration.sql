CREATE TABLE "contract_templates" (
  "id" UUID NOT NULL,
  "storage_key" TEXT NOT NULL,
  "content_type" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "contract_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "contract_templates_is_active_created_at_idx" ON "contract_templates"("is_active", "created_at" DESC);
