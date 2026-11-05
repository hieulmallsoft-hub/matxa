CREATE TABLE "legal_documents" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "audience" TEXT NOT NULL DEFAULT 'ALL',
  "version" INTEGER NOT NULL,
  "storage_key" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "legal_documents_code_version_key" ON "legal_documents"("code", "version");
CREATE INDEX "legal_documents_code_is_active_version_idx" ON "legal_documents"("code", "is_active", "version" DESC);
