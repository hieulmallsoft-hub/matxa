import { BadRequestException } from '@nestjs/common';
import { CoursesService, decodeFileName } from './courses.service';
import { UpdateLessonDto } from './dto/course.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

const send = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send })),
  PutObjectCommand: jest.fn((input) => ({ put: input })),
  DeleteObjectCommand: jest.fn((input) => ({ del: input })),
  GetObjectCommand: jest.fn((input) => ({ get: input })),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn(async (_c, command) => `https://signed/${command.get.Key}`) }));
const config = { get: (key: string) => ({ S3_BUCKET: 'b', S3_REGION: 'r', S3_ACCESS_KEY_ID: 'k', S3_SECRET_ACCESS_KEY: 's' })[key] };

beforeEach(() => jest.clearAllMocks());

it('reads uploaded Vietnamese file names back as UTF-8', () => {
  const garbled = Buffer.from('Yêu cầu chứng chỉ.pdf', 'utf8').toString('latin1');
  expect(decodeFileName(garbled)).toBe('Yêu cầu chứng chỉ.pdf');
  expect(decodeFileName('plain.pdf')).toBe('plain.pdf');
});

it('editing a lesson does not require sending its title again', async () => {
  expect(await validate(plainToInstance(UpdateLessonDto, { durationSeconds: 600 }))).toHaveLength(0);
});

describe('lesson files and illustration', () => {
  const lesson = { id: 'l1', courseId: 'c1', thumbnailKey: 'courses/c1/l1/thumbnail/old.png' };
  const prisma: any = {
    courseMedia: { findUnique: jest.fn().mockResolvedValue({ id: 'm1' }), update: jest.fn(async ({ data }: any) => ({ id: 'm1', ...data })) },
    courseLesson: {
      findUnique: jest.fn().mockResolvedValue({ ...lesson, media: [{ storageKey: 'courses/c1/l1/a.mp4' }] }),
      update: jest.fn(),
      delete: jest.fn(),
    },
    course: { findUnique: jest.fn().mockResolvedValue({ id: 'c1', coverKey: null, lessons: [{ id: 'l1', thumbnailKey: 'courses/c1/l1/thumbnail/new.png' }] }) },
  };
  const service = new CoursesService(prisma, config as any);
  const image = { buffer: Buffer.from('x'), size: 1, mimetype: 'image/png', originalname: 'a.png' };

  it('renames a file', async () => {
    await expect(service.updateMedia('m1', { title: '  Video phần 1 ' })).resolves.toMatchObject({ title: 'Video phần 1' });
  });

  it('uploads a lesson illustration, replaces the old one and returns a signed thumbnailUrl', async () => {
    const course: any = await service.uploadLessonThumbnail('l1', image);
    const key = prisma.courseLesson.update.mock.calls[0][0].data.thumbnailKey;
    expect(key).toMatch(/^courses\/c1\/l1\/thumbnail\/.+\.png$/);
    expect(send).toHaveBeenCalledWith({ del: { Bucket: 'b', Key: 'courses/c1/l1/thumbnail/old.png' } });
    expect(course.lessons[0].thumbnailUrl).toBe('https://signed/courses/c1/l1/thumbnail/new.png');
  });

  it('accepts only JPG, PNG or WEBP', async () => {
    await expect(service.uploadLessonThumbnail('l1', { ...image, mimetype: 'application/pdf' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deleting a lesson also removes its files from storage', async () => {
    await service.removeLesson('l1');
    expect(prisma.courseLesson.delete).toHaveBeenCalledWith({ where: { id: 'l1' } });
    expect(send).toHaveBeenCalledWith({ del: { Bucket: 'b', Key: 'courses/c1/l1/a.mp4' } });
    expect(send).toHaveBeenCalledWith({ del: { Bucket: 'b', Key: 'courses/c1/l1/thumbnail/old.png' } });
  });
});
