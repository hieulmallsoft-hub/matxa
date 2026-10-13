-- CreateEnum
CREATE TYPE "CourseAccess" AS ENUM ('FREE', 'VIP');

-- CreateEnum
CREATE TYPE "CourseMediaType" AS ENUM ('VIDEO', 'IMAGE', 'PDF');

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "cover_key" TEXT,
    "access" "CourseAccess" NOT NULL DEFAULT 'FREE',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_lessons" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "access" "CourseAccess" NOT NULL DEFAULT 'FREE',
    "duration_seconds" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_media" (
    "id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "type" "CourseMediaType" NOT NULL,
    "title" TEXT,
    "storage_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "file_size" INTEGER,
    "duration_seconds" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE INDEX "courses_is_published_sort_order_idx" ON "courses"("is_published", "sort_order");

-- CreateIndex
CREATE INDEX "course_lessons_course_id_sort_order_idx" ON "course_lessons"("course_id", "sort_order");

-- CreateIndex
CREATE INDEX "course_media_lesson_id_sort_order_idx" ON "course_media"("lesson_id", "sort_order");

-- AddForeignKey
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_media" ADD CONSTRAINT "course_media_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "course_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
