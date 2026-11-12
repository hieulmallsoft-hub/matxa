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
      response: { code: 'BOOKING_ALREADY_WAITING', bookingId: 'booking-1', bookingStatus: 'OPEN', bookingRole: 'CUSTOMER' },
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

  it('refuses a technician account booking as a customer while a job it took is not finished', async () => {
    const tx: any = {
      $queryRaw: jest.fn(),
      booking: { findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'job-1', status: 'CONFIRMED' }) },
    };
    const service: any = new BookingsService({} as any, { get: (_k: string, f: unknown) => f } as any, {} as any, {} as any);
    await expect(service.assertNoWaitingBooking(tx, 'tech-user-1')).rejects.toMatchObject({
      response: { code: 'BOOKING_ALREADY_WAITING', bookingId: 'job-1', bookingStatus: 'CONFIRMED', bookingRole: 'TECHNICIAN' },
    });
    expect(tx.booking.findFirst.mock.calls[1][0].where).toEqual({ status: 'CONFIRMED', technician: { is: { userId: 'tech-user-1' } } });
  });

  it('a technician cannot be announced, apply or be selected while its own booking as a customer is unfinished', async () => {
    const service: any = new BookingsService({} as any, { get: (_k: string, f: unknown) => f } as any, {} as any, {} as any);
    const db = {
      technicianProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'profile-1', userId: 'tech-user-1', city: 'HN', district: null, serviceModes: ['HOME'], latitude: null, longitude: null }) },
      // First: no job of its own; second: its own booking as a customer.
      booking: { findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'own-booking' }) },
    };
    const job = { id: 'b1', customerId: 'customer-1', assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN', mode: 'HOME', addressSnapshot: { city: 'HN' }, items: [] };
    await expect(service.assertOpenEligibility(db, job, 'profile-1')).rejects.toThrow('KTV dang co don dat voi tu cach khach chua xong');
    expect(db.booking.findFirst.mock.calls[1][0].where).toMatchObject({ customerId: 'tech-user-1', id: { not: 'b1' } });
  });

  it('allows it when nothing is waiting', async () => {
    await expect(subject(null).check()).resolves.toBeUndefined();
  });

  it('locks per customer before looking; counts taken bookings, and waiting ones still within their deadline', async () => {
    const { tx, calls, check } = subject(null);
    await check();
    expect(calls).toEqual(['lock', 'find', 'find']);
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
