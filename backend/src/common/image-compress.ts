import sharp = require('sharp');

/** Long-lived browser/app cache for files whose key never changes (keys carry a random id). */
export const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

/**
 * Shrinks an uploaded picture for phones: at most `maxWidth` wide (never enlarged), turned upright from its EXIF
 * orientation, metadata dropped, saved as WebP. A 2.4 MB 2600px PNG becomes roughly 100-200 KB.
 */
export async function compressImage(input: Buffer, maxWidth: number, quality = 80) {
  const buffer = await sharp(input, { failOn: 'none' })
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
  return { buffer, contentType: 'image/webp', ext: 'webp' };
}

/** Sizes used for course pictures. */
export const COURSE_COVER_WIDTH = 1280;
export const LESSON_THUMBNAIL_WIDTH = 800;
export const LESSON_IMAGE_WIDTH = 1600;
