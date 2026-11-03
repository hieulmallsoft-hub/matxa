import { BookingsService } from './bookings.service';

describe('customer sees technicians who applied to an open booking', () => {
  const application = {
    id: 'application-1',
    technicianProfileId: 'profile-1',
    status: 'APPLIED',
    appliedAt: new Date('2026-11-03T08:00:00.000Z'),
    createdAt: new Date('2026-11-03T08:00:00.000Z'),
    technicianProfile: {
      averageRating: '4.80',
      reviewCount: 15,
      user: { id: 'tech-user-1', displayName: 'Nguyễn Thị Mai', avatarUrl: 'https://cdn/mai.jpg' },
    },
  };

  function setup() {
    const booking: any = {
      id: 'booking-1', customerId: 'customer-1', assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN',
      technicianId: null, technician: null, items: [], payment: null, address: null, promotion: null, review: null,
      customer: { id: 'customer-1', displayName: 'Khách', avatarUrl: null, gender: null, nationality: null, role: 'CUSTOMER' },
      scheduledStart: new Date(), scheduledEnd: new Date(), subtotal: 0, serviceFee: 0, totalAmount: 0,
    };
    const prisma: any = {
      // Mirrors Prisma: relations come back only when the query includes them.
      booking: { findUnique: jest.fn(async (args: any) => ({ ...booking, ...(args.include?.applications ? { applications: [application] } : {}) })) },
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'CUSTOMER' }) },
    };
    const service = new BookingsService(prisma, { get: (_key: string, fallback: unknown) => fallback } as any, {} as any, {} as any);
    return { service, prisma };
  }

  it('returns the applicants from GET /bookings/:id with rating for the waiting screen', async () => {
    const { service } = setup();
    const detail: any = await service.detail('customer-1', 'booking-1');
    expect(detail.applications).toEqual([
      expect.objectContaining({
        applicationId: 'application-1',
        technicianId: 'profile-1',
        displayName: 'Nguyễn Thị Mai',
        avatarUrl: 'https://cdn/mai.jpg',
        averageRating: 4.8,
        reviewCount: 15,
        status: 'APPLIED',
        isApplicant: true,
      }),
    ]);
  });
});

describe('customer cancels a waiting open booking', () => {
  it('cancels, expires the applications and tells each applicant', async () => {
    const booking: any = {
      id: 'booking-1', customerId: 'customer-1', assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN',
      technicianId: null, technician: null, items: [], applications: [],
    };
    const prisma: any = {
      booking: {
        findUnique: jest.fn().mockResolvedValue(booking),
        update: jest.fn(async ({ data }: any) => ({ ...booking, ...data })),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'CUSTOMER' }) },
      bookingTechnicianApplication: {
        findMany: jest.fn().mockResolvedValue([{ technicianProfile: { userId: 'tech-user-1' } }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const notifications = { getTemplate: jest.fn().mockResolvedValue(null), create: jest.fn(), sendPush: jest.fn() };
    const service = new BookingsService(prisma, { get: (_key: string, fallback: unknown) => fallback } as any, notifications as any, {} as any);
    const result: any = await service.cancel('customer-1', 'booking-1', { reasonCode: 'NO_LONGER_NEEDED' });
    expect(result.status).toBe('CANCELLED');
    expect(prisma.booking.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'booking-1', status: 'OPEN' } }));
    expect(prisma.bookingTechnicianApplication.updateMany).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1', status: 'APPLIED' }, data: { status: 'EXPIRED', expiredAt: expect.any(Date) },
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(notifications.create).toHaveBeenCalledWith('tech-user-1', 'BOOKING_CANCELLED', expect.any(String), expect.any(String), 'matxa://bookings/booking-1');
  });
});
