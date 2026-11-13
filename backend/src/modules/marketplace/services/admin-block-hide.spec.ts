import { AdminMarketplaceService } from './admin-marketplace.service';

describe('admin blocks an account or hides a technician profile, with a reason', () => {
  it('blocking stores the reason and signs the person out of every device', async () => {
    const prisma: any = {
      user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUnique: jest.fn().mockResolvedValue({ id: 'u1', status: 'BLOCKED' }) },
      session: { updateMany: jest.fn() },
    };
    await new AdminMarketplaceService(prisma).updateUserStatus('admin', 'u1', { status: 'BLOCKED', reason: ' Huy don lien tuc ' });
    expect(prisma.user.updateMany.mock.calls[0][0].data).toMatchObject({ status: 'BLOCKED', blockedReason: 'Huy don lien tuc', blockedAt: expect.any(Date) });
    expect(prisma.session.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1', revokedAt: null }, data: { revokedAt: expect.any(Date) } });
  });

  it('unblocking clears the reason and keeps sessions alone', async () => {
    const prisma: any = {
      user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findUnique: jest.fn() },
      session: { updateMany: jest.fn() },
    };
    await new AdminMarketplaceService(prisma).updateUserStatus('admin', 'u1', { status: 'ACTIVE' });
    expect(prisma.user.updateMany.mock.calls[0][0].data).toEqual({ status: 'ACTIVE', blockedReason: null, blockedAt: null });
    expect(prisma.session.updateMany).not.toHaveBeenCalled();
  });

  const hideSetup = (isActive: boolean) => {
    const prisma: any = {
      technicianProfile: {
        findUnique: jest.fn().mockResolvedValueOnce({ userId: 'tech-user', isActive }).mockResolvedValue({ id: 'p1' }),
        update: jest.fn(),
      },
    };
    const notifications = { create: jest.fn(), sendPush: jest.fn() };
    return { prisma, notifications, service: new AdminMarketplaceService(prisma, notifications as any) };
  };

  it('hiding stores the reason and tells the technician why', async () => {
    const { prisma, notifications, service } = hideSetup(true);
    await service.updateTechnician('p1', { isActive: false, hiddenReason: 'Anh dai dien khong phu hop' });
    expect(prisma.technicianProfile.update.mock.calls[0][0].data).toEqual({ isActive: false, hiddenReason: 'Anh dai dien khong phu hop' });
    expect(notifications.create).toHaveBeenCalledWith('tech-user', 'TECHNICIAN_PROFILE_HIDDEN', expect.any(String), expect.stringContaining('Anh dai dien khong phu hop'), expect.any(String));
    expect(notifications.sendPush).toHaveBeenCalled();
  });

  it('showing again clears the reason and tells the technician', async () => {
    const { prisma, notifications, service } = hideSetup(false);
    await service.updateTechnician('p1', { isActive: true });
    expect(prisma.technicianProfile.update.mock.calls[0][0].data).toEqual({ isActive: true, hiddenReason: null });
    expect(notifications.create.mock.calls[0][1]).toBe('TECHNICIAN_PROFILE_SHOWN');
  });
});
