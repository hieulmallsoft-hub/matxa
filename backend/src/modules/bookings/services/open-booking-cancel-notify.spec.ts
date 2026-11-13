import { BookingsService } from './bookings.service';
import { releaseBookingPromotion } from './booking-promotion-release';
jest.mock('./booking-promotion-release', () => ({ releaseBookingPromotion: jest.fn().mockResolvedValue(false) }));
// Suspensions are covered by cancel-limit.spec; here nobody is suspended.
jest.mock('./cancel-limit', () => ({
  ...jest.requireActual('./cancel-limit'),
  activeSuspension: jest.fn().mockResolvedValue(null),
  assertNotSuspended: jest.fn().mockResolvedValue(undefined),
  applyCancelLimit: jest.fn().mockResolvedValue({ enabled: false, lockedUntil: null }),
}));

describe('customer cancels an open booking', () => {
  const booking: any = {
    id: 'booking-1', customerId: 'customer-1', assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN',
    technicianId: null, technician: null, requestedTechnicianId: 'requested-profile', items: [], applications: [],
  };
  const application = (userId: string, status: string) => ({ status, technicianProfile: { userId } });

  const subject = () => {
    const prisma: any = {
      booking: {
        findUnique: jest.fn().mockResolvedValue(booking),
        update: jest.fn(async ({ data }: any) => ({ ...booking, ...data })),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'CUSTOMER' }) },
      bookingTechnicianApplication: {
        findMany: jest.fn().mockResolvedValue([
          application('applied-user', 'APPLIED'),
          application('declined-user', 'DECLINED'),
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      // Everyone the booking was announced to, including the applicant and the decliner.
      notification: {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'requested-user' },
          { userId: 'notified-user' },
          { userId: 'applied-user' },
          { userId: 'declined-user' },
        ]),
      },
      walletLedgerEntry: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    prisma.$transaction = jest.fn((callback: any) => callback(prisma));
    const notifications = { getTemplate: jest.fn().mockResolvedValue(null), create: jest.fn(), sendPush: jest.fn() };
    const service = new BookingsService(prisma, { get: (_key: string, fallback: unknown) => fallback } as any, notifications as any, {} as any);
    return { service, prisma, notifications };
  };

  it('tells every technician the booking was announced to, except those who declined', async () => {
    const { service, prisma, notifications } = subject();
    await service.cancel('customer-1', 'booking-1', { reasonCode: 'WAIT_TOO_LONG' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { actionUrl: 'matxa://bookings/booking-1', type: { in: ['OPEN_BOOKING_AVAILABLE', 'OPEN_BOOKING_REQUESTED'] } },
      select: { userId: true },
    });
    const recipients = notifications.create.mock.calls
      .filter((call: any[]) => call[1] === 'BOOKING_CANCELLED')
      .map((call: any[]) => call[0])
      .sort();
    expect(recipients).toEqual(['applied-user', 'notified-user', 'requested-user']);
    expect(notifications.create).toHaveBeenCalledWith(
      'applied-user', 'BOOKING_CANCELLED', expect.any(String), 'Khách hàng đã hủy đơn mà bạn đang ứng tuyển.', 'matxa://bookings/booking-1');
    expect(notifications.create).toHaveBeenCalledWith(
      'notified-user', 'BOOKING_CANCELLED', expect.any(String), 'Khách hàng đã hủy đơn này.', 'matxa://bookings/booking-1');
  });

  it('gives the customer their voucher back when they cancel', async () => {
    const { service, prisma } = subject();
    await service.cancel('customer-1', 'booking-1', { reasonCode: 'WAIT_TOO_LONG' });
    expect(releaseBookingPromotion).toHaveBeenCalledWith(prisma, 'booking-1');
  });

  it('lets a notified technician open the cancelled job from that notification', async () => {
    const prisma: any = {
      booking: { findUnique: jest.fn().mockResolvedValue({ ...booking, status: 'CANCELLED' }) },
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'TECHNICIAN' }) },
      notification: { findFirst: jest.fn().mockResolvedValue({ id: 'n1' }) },
      technicianProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'notified-profile' }),
        findFirst: jest.fn().mockResolvedValue({ id: 'notified-profile' }),
      },
      bookingTechnicianApplication: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new BookingsService(prisma, { get: (_key: string, fallback: unknown) => fallback } as any, {} as any, {} as any);
    await expect(service.technicianJobDetail('notified-user', 'booking-1')).resolves.toMatchObject({ bookingStatus: 'CANCELLED' });
  });
});
