import { ForbiddenException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

// One account is a customer until its technician application is approved; it must never serve its own booking.
describe('a technician cannot take their own booking', () => {
  const profile = { id: 'profile-1', userId: 'user-1', city: 'HN', district: null, serviceModes: ['HOME'], latitude: null, longitude: null };
  const setup = () => {
    const prisma: any = {
      technicianProfile: { findFirst: jest.fn().mockResolvedValue(profile) },
      booking: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    return { prisma, service: new BookingsService(prisma, { get: (_k: string, d: unknown) => d } as any, {} as any, {} as any) };
  };
  const booking = (customerId: string) => ({
    id: 'b1', customerId, assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN', mode: 'HOME', addressSnapshot: { city: 'HN' }, items: [],
  });

  it('refuses (and so hides, skips announcing, refuses accept/select) a booking the same account made', async () => {
    const { prisma, service } = setup();
    const error = await (service as any).assertOpenEligibility(prisma, booking('user-1'), 'profile-1').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({ code: 'OWN_BOOKING' });
  });

  it('still checks other customers\' bookings normally', async () => {
    const { prisma, service } = setup();
    const error = await (service as any).assertOpenEligibility(prisma, booking('someone-else'), 'profile-1').catch((e: unknown) => e);
    expect((error as any)?.getResponse?.()?.code).not.toBe('OWN_BOOKING');
  });
});
