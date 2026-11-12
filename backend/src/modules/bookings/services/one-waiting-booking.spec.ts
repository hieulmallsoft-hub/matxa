import { ConflictException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

// A customer may only have one booking in progress at a time: waiting for a technician, or taken and not finished.
describe('one waiting booking per customer', () => {
  const subject = (waiting: { id: string } | null) => {
    const calls: string[] = [];
    const tx: any = {
      $queryRaw: jest.fn(async () => { calls.push('lock'); return []; }),
      booking: { findFirst: jest.fn(async () => { calls.push('find'); return waiting; }) },
    };
    const service = new BookingsService({} as any, { get: (_k: string, f: unknown) => f } as any, {} as any, {} as any);
    return { tx, calls, check: () => (service as any).assertNoWaitingBooking(tx, 'customer-1') };
  };

  it('refuses a new booking while one is still waiting, and says which one', async () => {
    const { check } = subject({ id: 'booking-1', status: 'OPEN' } as any);
    await expect(check()).rejects.toBeInstanceOf(ConflictException);
    await expect(check()).rejects.toMatchObject({
      response: { code: 'BOOKING_ALREADY_WAITING', bookingId: 'booking-1', bookingStatus: 'OPEN' },
    });
  });

  it('also refuses while a technician has taken a booking that is not finished yet', async () => {
    await expect(subject({ id: 'booking-2', status: 'CONFIRMED' } as any).check()).rejects.toMatchObject({
      response: { code: 'BOOKING_ALREADY_WAITING', bookingId: 'booking-2', bookingStatus: 'CONFIRMED' },
    });
  });

  it('is checked before anything else, so rebooking a busy technician still answers BOOKING_ALREADY_WAITING', async () => {
    const prisma: any = { booking: { findFirst: jest.fn().mockResolvedValue({ id: 'booking-1', status: 'CONFIRMED' }) } };
    const service = new BookingsService(prisma, { get: (_k: string, f: unknown) => f } as any, {} as any, {} as any);
    jest.spyOn(service as any, 'assertCustomer').mockResolvedValue(undefined);
    const eligibility = jest.spyOn(service as any, 'assertOpenEligibility');
    await expect(service.createOpen('customer-1', { mode: 'HOME' } as any, 'busy-technician')).rejects.toMatchObject({
      response: { code: 'BOOKING_ALREADY_WAITING', bookingId: 'booking-1' },
    });
    expect(eligibility).not.toHaveBeenCalled();
  });

  it('allows it when nothing is waiting', async () => {
    await expect(subject(null).check()).resolves.toBeUndefined();
  });

  it('locks per customer before looking; counts taken bookings, and waiting ones still within their deadline', async () => {
    const { tx, calls, check } = subject(null);
    await check();
    expect(calls).toEqual(['lock', 'find']);
    expect(tx.$queryRaw.mock.calls[0][0].values).toEqual(['customer-1']);
    const where = tx.booking.findFirst.mock.calls[0][0].where;
    expect(where.customerId).toBe('customer-1');
    expect(where.OR).toEqual([
      { status: 'CONFIRMED' },
      {
        status: { in: ['OPEN', 'PENDING'] },
        OR: [{ applicationDeadlineAt: null }, { applicationDeadlineAt: { gt: expect.any(Date) } }],
      },
    ]);
  });
});
