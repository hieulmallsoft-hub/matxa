import { BadRequestException } from '@nestjs/common';
import { TechnicianApplicationsService } from './technician-applications.service';

// The app only showed a generic "hồ sơ chưa đủ"; the technician could not tell what was missing.
describe('submitting a technician application', () => {
  const complete = {
    id: 'application-1', userId: 'user-1', status: 'DRAFT', displayName: 'Duc Nguyen', idCardNumber: '001099012345',
    idCardFrontKey: 'front.jpg', idCardBackKey: 'back.jpg', faceImageKey: 'face.jpg',
  };
  const subject = (application: object) => {
    const prisma: any = {
      technicianApplication: {
        findUnique: jest.fn().mockResolvedValue({ ...complete, ...application }),
        update: jest.fn(async ({ data }: any) => ({ ...complete, ...data })),
      },
      technicianKyc: { upsert: jest.fn() },
    };
    return new TechnicianApplicationsService(prisma, {} as any, { notifyAdmins: jest.fn() } as any);
  };

  it('names every missing item so the app can say exactly what to fix', async () => {
    const error = await subject({ faceImageKey: null, idCardBackKey: null })
      .submit('user-1')
      .catch((caught) => caught);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getResponse()).toMatchObject({
      message: 'Ho so con thieu: anh CCCD mat sau, anh khuon mat',
      missingFields: ['idCardBackKey', 'faceImageKey'],
    });
  });

  it('treats blank text as missing', async () => {
    const error = await subject({ displayName: '   ' }).submit('user-1').catch((caught) => caught);
    expect(error.getResponse()).toMatchObject({ missingFields: ['displayName'] });
  });

  it('does not require the ID card number: the admin reads it from the photos', async () => {
    await expect(subject({ idCardNumber: null }).submit('user-1')).resolves.toMatchObject({ status: 'SUBMITTED' });
  });

  it('submits a complete application', async () => {
    await expect(subject({}).submit('user-1')).resolves.toMatchObject({ status: 'SUBMITTED' });
  });
});
