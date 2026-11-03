import { TechnicianApplicationsService } from './technician-applications.service';

describe('TechnicianApplicationsService admin review data', () => {
  const user = {
    id: 'user-1',
    displayName: 'Mai',
    avatarUrl: null,
    identities: [
      { phoneNumber: null, email: 'mai@example.com' },
      { phoneNumber: '+84912345678', email: null },
    ],
  };

  it('lists applications with the applicant phone and email instead of raw identities', async () => {
    const prisma: any = {
      technicianApplication: {
        findMany: jest.fn().mockResolvedValue([{ id: 'app-1', status: 'SUBMITTED', user }]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const service = new TechnicianApplicationsService(prisma, {} as any, {} as any);
    const result = await service.list({ page: 1, limit: 20 });
    expect(result.items[0].user).toEqual({
      id: 'user-1', displayName: 'Mai', avatarUrl: null, phoneNumber: '+84912345678', email: 'mai@example.com',
    });
    expect(result.total).toBe(1);
  });

  it('signs KYC photos stored as KYC documents as well as legacy keys', async () => {
    const prisma: any = {
      technicianApplication: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'app-1',
          user,
          idCardFrontKey: 'technician-applications/front.jpg',
          idCardBackKey: null,
          faceImageKey: null,
          gallery: [],
          kyc: { documents: [
            { type: 'ID_CARD_FRONT', storageKey: 'technician-applications/front.jpg' },
            { type: 'ID_CARD_BACK', storageKey: 'technician-applications/back.jpg' },
          ] },
        }),
      },
    };
    const storage = { createPrivateViewUrl: jest.fn(async (key: string) => ({ viewUrl: `https://signed/${key}` })) };
    const service = new TechnicianApplicationsService(prisma, storage as any, {} as any);
    const detail = await service.detail('app-1');
    expect(detail.signedKyc.map((item) => item.storageKey)).toEqual([
      'technician-applications/front.jpg',
      'technician-applications/back.jpg',
    ]);
    expect(detail.user.phoneNumber).toBe('+84912345678');
  });
});
