import { OpenBookingExpirationService } from './open-booking-expiration.service';

describe('OpenBookingExpirationService', () => {
  afterEach(() => jest.useRealTimers());

  it('only scans overdue unassigned OPEN marketplace bookings and delegates atomic expiry', async () => {
    const prisma: any = { booking: { findMany: jest.fn().mockResolvedValue([{ id: 'due-1' }, { id: 'due-2' }]) } };
    const bookings = { expireOpenBookingIfDue: jest.fn()
      .mockResolvedValueOnce({ deadline: new Date('2026-10-06T00:00:00.000Z'), applicationCount: 2 })
      .mockResolvedValueOnce(null) };
    const config = { get: jest.fn((key: string, fallback: number) => key === 'OPEN_BOOKING_EXPIRATION_BATCH_SIZE' ? 50 : fallback) };
    const service = new OpenBookingExpirationService(prisma, bookings as any, config as any);

    await expect(service.run(new Date('2026-10-06T01:00:00.000Z'))).resolves.toEqual({ scanned: 2, expired: 1 });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN', technicianId: null, applicationDeadlineAt: { lte: new Date('2026-10-06T01:00:00.000Z') } }),
      take: 50,
    }));
    expect(bookings.expireOpenBookingIfDue).toHaveBeenCalledTimes(2);
  });

  it('uses a periodic timer but clears it on shutdown', () => {
    jest.useFakeTimers();
    const service = new OpenBookingExpirationService(
      { booking: { findMany: jest.fn().mockResolvedValue([]) } } as any,
      { expireOpenBookingIfDue: jest.fn() } as any,
      { get: jest.fn((_key: string, fallback: number) => fallback) } as any,
    );
    service.onModuleInit();
    service.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
  });
});
