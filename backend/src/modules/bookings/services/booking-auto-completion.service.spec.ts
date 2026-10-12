import { BookingAutoCompletionService } from './booking-auto-completion.service';

describe('BookingAutoCompletionService', () => {
  it('completes only confirmed bookings due after the 24-hour grace period', async () => {
    const now = new Date('2026-10-10T12:00:00.000Z');
    const prisma: any = {
      booking: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'booking-1', customerId: 'customer-1', technician: { userId: 'tech-user-1' } }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const notifications = { create: jest.fn(), sendPush: jest.fn().mockResolvedValue({ successCount: 1 }) };
    const config = { get: jest.fn((_key: string, fallback: number) => fallback) };
    const service = new BookingAutoCompletionService(prisma, notifications as any, config as any);

    await expect(service.run(now)).resolves.toEqual({ scanned: 1, completed: 1 });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'CONFIRMED', scheduledEnd: { lte: new Date('2026-10-09T12:00:00.000Z') } },
      }),
    );
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: 'CONFIRMED', scheduledEnd: { lte: new Date('2026-10-09T12:00:00.000Z') } },
      data: { status: 'COMPLETED' },
    });
    expect(notifications.sendPush).toHaveBeenCalledTimes(2);
  });

  it('does not notify when another action completed the booking first', async () => {
    const prisma: any = {
      booking: {
        findMany: jest.fn().mockResolvedValue([{ id: 'booking-1', customerId: 'customer-1', technician: null }]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const notifications = { create: jest.fn(), sendPush: jest.fn() };
    const service = new BookingAutoCompletionService(
      prisma,
      notifications as any,
      { get: jest.fn((_key: string, fallback: number) => fallback) } as any,
    );

    await expect(service.run(new Date('2026-10-10T12:00:00.000Z'))).resolves.toEqual({ scanned: 1, completed: 0 });
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('clears its timer on shutdown', () => {
    jest.useFakeTimers();
    const service = new BookingAutoCompletionService(
      { booking: { findMany: jest.fn().mockResolvedValue([]) } } as any,
      {} as any,
      { get: jest.fn((_key: string, fallback: number) => fallback) } as any,
    );
    service.onModuleInit();
    service.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });
});
