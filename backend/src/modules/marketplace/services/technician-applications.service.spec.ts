import { TechnicianApplicationsService } from './technician-applications.service';

describe('TechnicianApplicationsService.getMine', () => {
  it('returns short-lived private read URLs for the owner gallery and KYC documents', async () => {
    const prisma: any = {
      technicianApplication: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'application-1',
          userId: 'user-1',
          idCardFrontKey: 'technician-applications/user-1/id_card_front/a.jpg',
          idCardBackKey: null,
          faceImageKey: 'technician-applications/user-1/face/b.jpg',
          gallery: [{ id: 'gallery-1', storageKey: 'technician-applications/user-1/gallery/c.jpg', sortOrder: 0 }],
          kyc: { status: 'PENDING_VERIFICATION', documents: [] },
        }),
      },
    };
    const storage = {
      createPrivateViewUrl: jest.fn(async (storageKey: string) => ({
        viewUrl: `https://signed/${storageKey}`,
        expiresIn: 300,
      })),
    };
    const service = new TechnicianApplicationsService(prisma, storage as any, { create: jest.fn() } as any);

    const result = await service.getMine('user-1');

    expect(result?.gallery[0]).toMatchObject({
      storageKey: expect.any(String),
      viewUrl: expect.stringContaining('gallery'),
    });
    expect(result?.documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'ID_CARD_FRONT', viewUrl: expect.stringContaining('id_card_front') }),
        expect.objectContaining({ type: 'FACE', viewUrl: expect.stringContaining('face') }),
      ]),
    );
    expect(storage.createPrivateViewUrl).toHaveBeenCalledTimes(3);
  });
});
