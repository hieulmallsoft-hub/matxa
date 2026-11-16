/**
 * One-off: shrinks course pictures uploaded before compression existed (covers, lesson illustrations, lesson images)
 * to WebP, points the rows at the new files and deletes the old ones.
 *
 *   npm run images:compress-courses            # dry run: lists what would change
 *   npm run images:compress-courses -- --apply # does it
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { compressImage, COURSE_COVER_WIDTH, IMMUTABLE_CACHE, LESSON_IMAGE_WIDTH, LESSON_THUMBNAIL_WIDTH } from '../common/image-compress';

const apply = process.argv.includes('--apply');
const env = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Thieu ${name}`);
  return value;
};

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env('DATABASE_URL') }) });
  const bucket = env('S3_BUCKET');
  const s3 = new S3Client({
    region: env('S3_REGION'),
    credentials: { accessKeyId: env('S3_ACCESS_KEY_ID'), secretAccessKey: env('S3_SECRET_ACCESS_KEY') },
    endpoint: process.env.S3_ENDPOINT || undefined,
  });
  let before = 0;
  let after = 0;

  /** Downloads `key`, compresses it and (with --apply) stores it next to it as .webp. Returns the new key. */
  const shrink = async (label: string, key: string, width: number) => {
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const input = Buffer.from(await object.Body!.transformToByteArray());
    const picture = await compressImage(input, width);
    before += input.length;
    after += picture.buffer.length;
    const newKey = `${key.slice(0, key.lastIndexOf('/'))}/${randomUUID()}.${picture.ext}`;
    console.log(`${label}: ${Math.round(input.length / 1024)} KB -> ${Math.round(picture.buffer.length / 1024)} KB`);
    if (!apply) return null;
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: newKey, Body: picture.buffer, ContentType: picture.contentType, CacheControl: IMMUTABLE_CACHE }));
    return { newKey, size: picture.buffer.length, contentType: picture.contentType };
  };
  const removeOld = (key: string) => s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);

  try {
    for (const course of await prisma.course.findMany({ where: { coverKey: { not: null } } })) {
      if (course.coverKey!.endsWith('.webp')) continue;
      const done = await shrink(`Bia "${course.title}"`, course.coverKey!, COURSE_COVER_WIDTH);
      if (done) {
        await prisma.course.update({ where: { id: course.id }, data: { coverKey: done.newKey } });
        await removeOld(course.coverKey!);
      }
    }
    for (const lesson of await prisma.courseLesson.findMany({ where: { thumbnailKey: { not: null } } })) {
      if (lesson.thumbnailKey!.endsWith('.webp')) continue;
      const done = await shrink(`Anh minh hoa "${lesson.title}"`, lesson.thumbnailKey!, LESSON_THUMBNAIL_WIDTH);
      if (done) {
        await prisma.courseLesson.update({ where: { id: lesson.id }, data: { thumbnailKey: done.newKey } });
        await removeOld(lesson.thumbnailKey!);
      }
    }
    const images = await prisma.courseMedia.findMany({ where: { type: 'IMAGE', contentType: { in: ['image/jpeg', 'image/png'] } } });
    for (const media of images) {
      const done = await shrink(`Anh bai hoc "${media.title ?? media.id}"`, media.storageKey, LESSON_IMAGE_WIDTH);
      if (done) {
        await prisma.courseMedia.update({ where: { id: media.id }, data: { storageKey: done.newKey, contentType: done.contentType, fileSize: done.size } });
        await removeOld(media.storageKey);
      }
    }
    console.log(`\nTong: ${Math.round(before / 1024)} KB -> ${Math.round(after / 1024)} KB${apply ? '' : ' (chay thu, chua doi gi; them --apply de thuc hien)'}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
