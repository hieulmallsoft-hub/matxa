import { ConflictException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
// Suspensions are covered by cancel-limit.spec; here nobody is suspended.
jest.mock('./cancel-limit', () => ({
  ...jest.requireActual('./cancel-limit'),
  activeSuspension: jest.fn().mockResolvedValue(null),
  assertNotSuspended: jest.fn().mockResolvedValue(undefined),
  applyCancelLimit: jest.fn().mockResolvedValue({ enabled: false, lockedUntil: null }),
}));

describe('technician applies to an open booking', () => {
  // 400.000đ of services at the default 25% platform fee = 100.000đ commission on selection.
  const subject = (balanceVnd: number | null, grossServiceAmount = 400000) => {
    const prisma: any = {
      userIdentity: { findFirst: jest.fn().mockResolvedValue({ id: 'phone-1' }) },
      technicianProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'profile-1' }) },
      bookingTechnicianApplication: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: any) => ({ id: 'application-1', ...data })),
      },
      wallet: { findUnique: jest.fn().mockResolvedValue(balanceVnd === null ? null : { balanceVnd }) },
      booking: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    prisma.$transaction = jest.fn((callback: any) => callback(prisma));
    const notifications = { getTemplate: jest.fn().mockResolvedValue(null), create: jest.fn(), sendPush: jest.fn() };
    const service = new BookingsService(prisma, { get: (_key: string, fallback: unknown) => fallback } as any, notifications as any, {} as any);
    jest
      .spyOn(service as any, 'openJobForTechnician')
      .mockResolvedValue({ id: 'booking-1', customerId: 'customer-1', grossServiceAmount });
    return { service, prisma };
  };

  it('rejects a technician whose wallet cannot cover the commission', async () => {
    const { service, prisma } = subject(99999);
    await expect(service.applyToOpenJob('tech-user-1', 'booking-1')).rejects.toThrow(
      new ConflictException('So du vi khong du de nhan don'),
    );
    expect(prisma.wallet.findUnique).toHaveBeenCalledWith({
      where: { userId_type: { userId: 'tech-user-1', type: 'ADVERTISING_CREDIT' } },
      select: { balanceVnd: true },
    });
    expect(prisma.bookingTechnicianApplication.create).not.toHaveBeenCalled();
  });

  it('rejects a technician without a wallet', async () => {
    const { service } = subject(null);
    await expect(service.applyToOpenJob('tech-user-1', 'booking-1')).rejects.toThrow('So du vi khong du de nhan don');
  });

  it('accepts a technician whose wallet covers the commission exactly', async () => {
    const { service, prisma } = subject(100000);
    await expect(service.applyToOpenJob('tech-user-1', 'booking-1')).resolves.toMatchObject({ status: 'APPLIED' });
    expect(prisma.bookingTechnicianApplication.create).toHaveBeenCalled();
  });

  it('skips the wallet check when the booking carries no commission', async () => {
    const { service, prisma } = subject(0, 0);
    await expect(service.applyToOpenJob('tech-user-1', 'booking-1')).resolves.toMatchObject({ status: 'APPLIED' });
    expect(prisma.wallet.findUnique).not.toHaveBeenCalled();
  });
});
