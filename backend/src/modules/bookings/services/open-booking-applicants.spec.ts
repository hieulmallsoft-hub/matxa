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

describe('requested technician declines a waiting open booking', () => {
  function setup(profileId: string) {
    const booking: any = {
      id: 'booking-1', customerId: 'customer-1', assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN',
      technicianId: null, requestedTechnicianId: 'requested-profile', items: [],
    };
    const prisma: any = {
      technicianProfile: { findFirst: jest.fn().mockResolvedValue({ id: profileId }) },
      user: { findUnique: jest.fn().mockResolvedValue({ displayName: 'Kim Nguyễn' }) },
      bookingTechnicianApplication: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }: any) => ({ id: 'application-1', ...data })),
      },
    };
    const notifications = { getTemplate: jest.fn().mockResolvedValue(null), create: jest.fn(), sendPush: jest.fn() };
    const service = new BookingsService(prisma, { get: (_key: string, fallback: unknown) => fallback } as any, notifications as any, {} as any);
    jest.spyOn(service as any, 'openJobForTechnician').mockResolvedValue(booking);
    return { service, notifications };
  }

  it('keeps the booking open and tells the customer they can pick another applicant', async () => {
    const { service, notifications } = setup('requested-profile');
    const result: any = await service.declineOpenJob('tech-user', 'booking-1');
    expect(result.status).toBe('DECLINED');
    await new Promise((resolve) => setImmediate(resolve));
    expect(notifications.create).toHaveBeenCalledWith(
      'customer-1', 'REQUESTED_TECHNICIAN_DECLINED', expect.any(String),
      expect.stringContaining('Kim Nguyễn'), 'matxa://bookings/booking-1');
  });

  it('does not notify the customer when another technician hides the job', async () => {
    const { service, notifications } = setup('other-profile');
    await service.declineOpenJob('tech-user', 'booking-1');
    await new Promise((resolve) => setImmediate(resolve));
    expect(notifications.create).not.toHaveBeenCalled();
  });
});

describe('cancel button on the waiting screen', () => {
  it.each([
    ['OPEN', true],
    ['PENDING', true],
    ['CONFIRMED', true],
    ['COMPLETED', false],
    ['EXPIRED', false],
  ])('customer canCancel for %s is %s', (status, expected) => {
    const service = new BookingsService({} as any, { get: (_key: string, fallback: unknown) => fallback } as any, {} as any, {} as any);
    const response = (service as any).historyResponse({ id: 'b1', customerId: 'customer-1', status, items: [] }, 'customer-1');
    expect(response.canCancel).toBe(expected);
  });
});

describe('creating a booking for a chosen technician', () => {
  function setup() {
    const prisma: any = {
      serviceCatalogItem: { findMany: jest.fn().mockResolvedValue([
        { id: 'catalog', name: 'Massage', categoryId: 'category', category: { name: 'Massage' }, modes: ['HOME'],
          priceOptions: [{ id: 'option', durationMinutes: 60, price: 100000 }] },
      ]) },
      address: { findFirst: jest.fn().mockResolvedValue({ id: 'address', city: 'HN', district: null }) },
      booking: { create: jest.fn().mockResolvedValue({ id: 'booking-1', items: [] }) },
    };
    const service = new BookingsService(prisma, { get: (_key: string, fallback: unknown) => fallback } as any, {} as any, {} as any);
    jest.spyOn(service as any, 'notifyEligibleTechniciansForOpenBooking').mockResolvedValue(undefined);
    const dto: any = {
      items: [{ catalogServiceId: 'catalog', priceOptionId: 'option' }],
      scheduledStart: new Date(Date.now() + 86_400_000).toISOString(),
      mode: 'HOME', city: 'HN', addressId: 'address', paymentMethod: 'CASH',
    };
    return { service, prisma, dto };
  }

  it('rejects the booking when the chosen technician cannot take it, so the customer is not left waiting', async () => {
    const { service, prisma, dto } = setup();
    jest.spyOn(service as any, 'assertOpenEligibility').mockRejectedValue(new Error('KTV khong ranh trong khung gio nay'));
    await expect(service.createOpen('customer-1', dto, 'busy-profile')).rejects.toThrow('KTV khong ranh trong khung gio nay');
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it('checks the chosen technician against the booking time and services before saving', async () => {
    const { service, prisma, dto } = setup();
    const check = jest.spyOn(service as any, 'assertOpenEligibility').mockResolvedValue(undefined);
    await service.createOpen('customer-1', dto, 'free-profile');
    expect(check).toHaveBeenCalledWith(prisma, expect.objectContaining({
      assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN', mode: 'HOME',
      items: [{ catalogService: expect.objectContaining({ id: 'catalog', categoryId: 'category' }) }],
    }), 'free-profile');
    expect(prisma.booking.create).toHaveBeenCalled();
  });
});
