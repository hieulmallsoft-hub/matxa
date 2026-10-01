ALTER TABLE "technician_applications"
  ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "under_review_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMP(3);

CREATE TABLE "cities" (
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "cities_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "districts" (
  "code" TEXT NOT NULL,
  "city_code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "districts_pkey" PRIMARY KEY ("code")
);

CREATE INDEX "districts_city_code_is_active_sort_order_idx" ON "districts"("city_code", "is_active", "sort_order");
ALTER TABLE "districts" ADD CONSTRAINT "districts_city_code_fkey" FOREIGN KEY ("city_code") REFERENCES "cities"("code") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "cities" ("code", "name", "sort_order") VALUES
  ('HN', 'Hà Nội', 1), ('HCM', 'Hồ Chí Minh', 2), ('DN', 'Đà Nẵng', 3)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "districts" ("code", "city_code", "name", "sort_order") VALUES
  ('HN-BA-DINH', 'HN', 'Ba Đình', 1), ('HN-CAU-GIAY', 'HN', 'Cầu Giấy', 2), ('HN-DONG-DA', 'HN', 'Đống Đa', 3), ('HN-HAI-BA-TRUNG', 'HN', 'Hai Bà Trưng', 4),
  ('HCM-Q1', 'HCM', 'Quận 1', 1), ('HCM-Q3', 'HCM', 'Quận 3', 2), ('HCM-BINH-THANH', 'HCM', 'Bình Thạnh', 3),
  ('DN-HAI-CHAU', 'DN', 'Hải Châu', 1), ('DN-SON-TRA', 'DN', 'Sơn Trà', 2)
ON CONFLICT ("code") DO NOTHING;
