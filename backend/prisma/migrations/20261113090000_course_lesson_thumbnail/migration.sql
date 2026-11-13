-- Lesson illustration image.
ALTER TABLE "course_lessons" ADD COLUMN "thumbnail_key" TEXT;

-- File names uploaded before the fix were stored as UTF-8 bytes read as Latin-1 ("YÃªu cáº§u" for "Yêu cầu").
-- Only names made of Latin-1 characters with a UTF-8 lead byte followed by a continuation byte are re-read; a name
-- that does not decode cleanly is left as it is.
DO $$
DECLARE row RECORD;
BEGIN
  FOR row IN
    SELECT id, title FROM course_media
    WHERE title IS NOT NULL
      AND title ~ E'[À-ÿ][\u0080-¿]'
      AND title !~ E'[^\u0001-ÿ]'
  LOOP
    BEGIN
      UPDATE course_media SET title = convert_from(convert_to(row.title, 'LATIN1'), 'UTF8') WHERE id = row.id;
    EXCEPTION WHEN others THEN NULL;
    END;
  END LOOP;
END $$;
