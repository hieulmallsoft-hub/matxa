import { BookingsService } from './bookings.service';

describe('open booking expiry transition', () => {
  it('atomically expires only OPEN unassigned marketplace bookings and APPLIED applications', async () => {
    const tx: any = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({ id: 'booking-1', customerId: 'customer-1', applicationDeadlineAt: new Date('2026-10-06T00:00:00.000Z') }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      bookingTechnicianApplication: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma: any = { $transaction: jest.fn((callback: any) => callback(tx)) };
    const notifications = { create: jest.fn().mockResolvedValue({}), sendPush: jest.fn().mockResolvedValue({}) };
    const service = new BookingsService(prisma, { get: jest.fn() } as any, notifications as any, { createPaymentUrl: jest.fn(), verify: jest.fn() } as any);
    const now = new Date('2026-10-06T01:00:00.000Z');

    await expect(service.expireOpenBookingIfDue('booking-1', now)).resolves.toMatchObject({ customerId: 'customer-1', applicationCount: 2, expiredAt: now });
    expect(tx.booking.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN', technicianId: null, applicationDeadlineAt: { lte: now } }),
      data: { status: 'EXPIRED', expiredAt: now },
    }));
    expect(tx.bookingTechnicianApplication.updateMany).toHaveBeenCalledWith({ where: { bookingId: 'booking-1', status: 'APPLIED' }, data: { status: 'EXPIRED', expiredAt: now } });
  });

  it('is idempotent when another worker or customer already claimed the booking', async () => {
    const tx: any = {
      booking: { findUnique: jest.fn().mockResolvedValue({ id: 'booking-1', customerId: 'customer-1', applicationDeadlineAt: new Date('2026-10-06T00:00:00.000Z') }), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      bookingTechnicianApplication: { updateMany: jest.fn() },
    };
    const prisma: any = { $transaction: jest.fn((callback: any) => callback(tx)) };
    const service = new BookingsService(prisma, { get: jest.fn() } as any, { create: jest.fn(), sendPush: jest.fn() } as any, { createPaymentUrl: jest.fn(), verify: jest.fn() } as any);
    await expect(service.expireOpenBookingIfDue('booking-1', new Date('2026-10-06T01:00:00.000Z'))).resolves.toBeNull();
    expect(tx.bookingTechnicianApplication.updateMany).not.toHaveBeenCalled();
  });
});
