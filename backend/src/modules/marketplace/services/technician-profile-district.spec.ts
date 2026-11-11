import { MarketplaceService } from './marketplace.service';

// PATCH /technician/profile: an approved technician changes their province and ward.
describe('technician profile ward', () => {
  const subject = (saved: { city: string | null; district: string | null }) => {
    const prisma: any = {
      technicianProfile: {
        findUnique: jest.fn().mockResolvedValue(saved),
        upsert: jest.fn(async ({ update }: any) => update),
      },
      city: { findMany: jest.fn().mockResolvedValue([{ code: 'HN', name: 'Hà Nội' }, { code: 'HP', name: 'Hải Phòng' }]) },
      district: {
        findMany: jest.fn(async ({ where }: any) =>
          ({
            HN: [{ code: 'HN-PHUONG-CAU-GIAY', name: 'Phường Cầu Giấy' }, { code: 'HN-PHUONG-BA-DINH', name: 'Phường Ba Đình' }],
            HP: [{ code: 'HP-PHUONG-HONG-BANG', name: 'Phường Hồng Bàng' }],
          })[where.cityCode as string] ?? []),
      },
    };
    const service = new MarketplaceService(prisma, {} as any);
    jest.spyOn(service as any, 'requireRole').mockResolvedValue(undefined);
    return { service, prisma };
  };

  it('saves province and ward codes, also from names', async () => {
    const { service } = subject({ city: null, district: null });
    await expect(service.upsertMyProfile('u1', { city: 'Hà Nội', district: 'Cầu Giấy' } as any))
      .resolves.toMatchObject({ city: 'HN', district: 'HN-PHUONG-CAU-GIAY' });
  });

  it('checks a ward alone against the saved province', async () => {
    const { service } = subject({ city: 'HN', district: 'HN-PHUONG-CAU-GIAY' });
    await expect(service.upsertMyProfile('u1', { district: 'HN-PHUONG-BA-DINH' } as any)).resolves.toMatchObject({ district: 'HN-PHUONG-BA-DINH' });
    await expect(service.upsertMyProfile('u1', { district: 'HP-PHUONG-HONG-BANG' } as any)).rejects.toMatchObject({
      response: { code: 'INVALID_DISTRICT' },
    });
  });

  it('clears the old ward when the province changes without a new ward', async () => {
    const { service } = subject({ city: 'HN', district: 'HN-PHUONG-CAU-GIAY' });
    await expect(service.upsertMyProfile('u1', { city: 'HP' } as any)).resolves.toMatchObject({ city: 'HP', district: null });
  });

  it('leaves the ward alone when location is not sent or the same province is resent', async () => {
    const { service, prisma } = subject({ city: 'HN', district: 'HN-PHUONG-CAU-GIAY' });
    const bio = await service.upsertMyProfile('u1', { bio: 'x' } as any);
    expect(bio).not.toHaveProperty('district');
    expect(prisma.technicianProfile.findUnique).not.toHaveBeenCalled();
    await expect(service.upsertMyProfile('u1', { city: 'HN' } as any)).resolves.not.toHaveProperty('district', null);
  });
});
