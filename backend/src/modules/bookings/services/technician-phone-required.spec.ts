import { BookingsService } from './bookings.service';

// Customers call the technician they booked: a technician without a phone number cannot take a job.
describe('technician without a phone number', () => {
  const service = (requireTechnicianPhone = true) => {
    const prisma: any = {
      technicianProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'tech-profile-1', latitude: 0, longitude: 0 }) },
      userIdentity: { findFirst: jest.fn().mockResolvedValue(null) },
      booking: { findFirst: jest.fn(), findUnique: jest.fn() },
    };
    const settings = { getBookingRules: jest.fn().mockResolvedValue({ requireTechnicianPhone }) };
    return {
      prisma,
      bookings: new BookingsService(
        prisma, { get: jest.fn((_k: string, d: unknown) => d) } as any, {} as any, {} as any, undefined, undefined, undefined, settings as any,
      ),
    };
  };

  it('cannot apply to an open booking', async () => {
    const { prisma, bookings } = service();
    const error = await bookings.applyToOpenJob('tech-user-1', 'booking-1').catch((caught) => caught);
    expect(error.getResponse()).toMatchObject({ statusCode: 409, code: 'PHONE_REQUIRED' });
    expect(prisma.booking.findFirst).not.toHaveBeenCalled();
  });

  it('cannot accept a direct booking', async () => {
    const { prisma, bookings } = service();
    const error = await bookings.acceptTechnicianJob('tech-user-1', 'booking-1').catch((caught) => caught);
    expect(error.getResponse()).toMatchObject({ code: 'PHONE_REQUIRED' });
    expect(prisma.booking.findUnique).not.toHaveBeenCalled();
  });

  it('lets them take jobs while the admin has not switched the rule on', async () => {
    const { prisma, bookings } = service(false);
    prisma.booking.findUnique.mockResolvedValue(null);
    const error = await bookings.acceptTechnicianJob('tech-user-1', 'booking-1').catch((caught) => caught);
    expect(error?.getResponse?.()).not.toMatchObject({ code: 'PHONE_REQUIRED' });
    expect(prisma.userIdentity.findFirst).not.toHaveBeenCalled();
  });
});
