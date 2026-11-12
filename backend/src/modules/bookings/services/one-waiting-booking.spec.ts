import { ConflictException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

// A customer may only have one booking waiting for a technician at a time.
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
    const { check } = subject({ id: 'booking-1' });
    await expect(check()).rejects.toBeInstanceOf(ConflictException);
    await expect(check()).rejects.toMatchObject({ response: { code: 'BOOKING_ALREADY_WAITING', bookingId: 'booking-1' } });
  });

  it('allows it when nothing is waiting', async () => {
    await expect(subject(null).check()).resolves.toBeUndefined();
  });

  it('locks per customer before looking, and only counts waiting bookings still within their deadline', async () => {
    const { tx, calls, check } = subject(null);
    await check();
    expect(calls).toEqual(['lock', 'find']);
    expect(tx.$queryRaw.mock.calls[0][0].values).toEqual(['customer-1']);
    const where = tx.booking.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ customerId: 'customer-1', status: { in: ['OPEN', 'PENDING'] } });
    expect(where.OR).toEqual([{ applicationDeadlineAt: null }, { applicationDeadlineAt: { gt: expect.any(Date) } }]);
  });
});
