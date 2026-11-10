import { BadRequestException } from '@nestjs/common';
import { CoursesService } from './courses.service';

const send = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send })),
  PutObjectCommand: jest.fn((input) => ({ put: input })),
  DeleteObjectCommand: jest.fn((input) => ({ del: input })),
  GetObjectCommand: jest.fn((input) => ({ get: input })),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn(async (_c, command) => `https://signed/${command.get.Key}`) }));

const COURSE = '10000000-0000-4000-8000-000000000001';
const config = { get: (key: string) => ({ S3_BUCKET: 'b', S3_REGION: 'r', S3_ACCESS_KEY_ID: 'k', S3_SECRET_ACCESS_KEY: 's' })[key] };

describe('course cover upload (through the API, the bucket has no CORS)', () => {
  let course: any;
  const prisma: any = {
    course: {
      findUnique: jest.fn(async () => course),
      update: jest.fn(async ({ data }: any) => (course = { ...course, ...data })),
    },
  };
  const service = new CoursesService(prisma, config as any);
  const image = { buffer: Buffer.from('x'), size: 1, mimetype: 'image/png', originalname: 'a.png' };

  beforeEach(() => {
    jest.clearAllMocks();
    course = { id: COURSE, coverKey: `courses/${COURSE}/cover/old.jpg`, lessons: [] };
  });

  it('stores the image, points the course at it, drops the old cover and returns a signed coverUrl', async () => {
    const result: any = await service.uploadCover(COURSE, image);
    const put = send.mock.calls.find(([command]) => command.put)![0].put;
    expect(put).toMatchObject({ Bucket: 'b', ContentType: 'image/png', Body: image.buffer });
    expect(put.Key).toMatch(new RegExp(`^courses/${COURSE}/cover/[0-9a-f-]+\\.png$`));
    expect(prisma.course.update).toHaveBeenCalledWith({ where: { id: COURSE }, data: { coverKey: put.Key } });
    expect(send.mock.calls.some(([command]) => command.del?.Key === `courses/${COURSE}/cover/old.jpg`)).toBe(true);
    expect(result.coverUrl).toBe(`https://signed/${put.Key}`);
  });

  it('rejects files that are not images', async () => {
    await expect(service.uploadCover(COURSE, { ...image, mimetype: 'application/pdf' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.course.update).not.toHaveBeenCalled();
  });

  it('returns coverUrl null for a course without a cover', async () => {
    course = { id: COURSE, coverKey: null, lessons: [] };
    await expect(service.get(COURSE)).resolves.toMatchObject({ coverUrl: null });
  });
});
