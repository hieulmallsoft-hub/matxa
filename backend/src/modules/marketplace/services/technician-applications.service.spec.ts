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

  it('sends an FCM push when KYC needs more information', async () => {
    const prisma: any = {
      technicianApplication: { findUnique: jest.fn().mockResolvedValue({ id: 'application-1', userId: 'user-1' }) },
      technicianKyc: { upsert: jest.fn().mockResolvedValue({ id: 'kyc-1', status: 'REJECTED' }) },
    };
    const notifications = { create: jest.fn(), sendPush: jest.fn().mockResolvedValue({ successCount: 1 }) };
    const service = new TechnicianApplicationsService(prisma, {} as any, notifications as any);

    await service.reviewKyc('admin-1', 'application-1', 'REJECTED', 'Anh giay to chua ro');

    expect(notifications.sendPush).toHaveBeenCalledWith(
      'user-1',
      'KYC cần bổ sung',
      'Anh giay to chua ro',
      expect.objectContaining({
        type: 'TECHNICIAN_KYC_REJECTED',
        applicationId: 'application-1',
        actionUrl: 'matxa://technician/application',
      }),
    );
  });

  it('sends an FCM push when an application is rejected', async () => {
    const prisma: any = {
      technicianApplication: {
        findUnique: jest.fn().mockResolvedValue({ id: 'application-1', userId: 'user-1', status: 'SUBMITTED' }),
        update: jest.fn().mockResolvedValue({ id: 'application-1', status: 'REJECTED' }),
      },
      technicianKyc: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const notifications = { create: jest.fn(), sendPush: jest.fn().mockResolvedValue({ successCount: 1 }) };
    const service = new TechnicianApplicationsService(prisma, {} as any, notifications as any);

    await service.reject('admin-1', 'application-1', 'Can bo sung thong tin');

    expect(notifications.sendPush).toHaveBeenCalledWith(
      'user-1',
      'Hồ sơ KTV cần bổ sung',
      'Can bo sung thong tin',
      expect.objectContaining({
        type: 'TECHNICIAN_APPLICATION_REJECTED',
        applicationId: 'application-1',
        actionUrl: 'matxa://technician/application',
      }),
    );
  });
});

describe('TechnicianApplicationsService.updateMine with the ID card QR', () => {
  const setup = () => {
    const prisma: any = {
      technicianApplication: {
        upsert: jest.fn().mockResolvedValue({ status: 'DRAFT', supportedModes: ['HOME'], gender: null }),
        update: jest.fn(async ({ data }) => data),
      },
    };
    return { prisma, service: new TechnicianApplicationsService(prisma, {} as any, {} as any) };
  };

  it('stores what the QR says and takes the ID number from it', async () => {
    const { prisma, service } = setup();
    await service.updateMine('user-1', { idCardQr: '001099012345|123456789|Nguyễn Văn An|01011999|Nam|Cầu Giấy, Hà Nội|15082021' });
    const { data } = prisma.technicianApplication.update.mock.calls[0][0];
    expect(data).toMatchObject({ idCardNumber: '001099012345', gender: 'MALE', idCardInfo: { fullName: 'Nguyễn Văn An', issueDate: '2021-08-15' } });
    expect(data).not.toHaveProperty('idCardQr');
  });

  it('says the scan is wrong instead of saving a bad QR', async () => {
    const { prisma, service } = setup();
    await expect(service.updateMine('user-1', { idCardQr: 'https://example.com' })).rejects.toThrow('Ma QR CCCD khong hop le');
    expect(prisma.technicianApplication.update).not.toHaveBeenCalled();
  });
});
