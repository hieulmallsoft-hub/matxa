import { BookingsService } from './bookings.service';
// Area codes are covered by location-code.spec; here the city/ward pass through unchanged.
jest.mock('../../marketplace/services/location-code', () => ({ resolveLocationCodes: jest.fn(async (_db: unknown, city: unknown, district: unknown) => ({ city, district })) }));
// These cover other rules; the customer-only check has its own spec.
// Suspensions are covered by cancel-limit.spec; here nobody is suspended.
jest.mock('./cancel-limit', () => ({
  ...jest.requireActual('./cancel-limit'),
  activeSuspension: jest.fn().mockResolvedValue(null),
  assertNotSuspended: jest.fn().mockResolvedValue(undefined),
  applyCancelLimit: jest.fn().mockResolvedValue({ enabled: false, lockedUntil: null }),
}));
beforeEach(() => jest.spyOn(BookingsService.prototype as any, 'assertCustomer').mockResolvedValue(undefined));

describe('booking request recipient', () => {
  const booking: any = {
    id: 'booking-1', customerId: 'customer-1', assignmentMode: 'OPEN_MARKETPLACE',
    status: 'OPEN', technicianId: null, requestedTechnicianId: 'preferred-profile',
    scheduledStart: new Date(Date.now() + 3_600_000), scheduledEnd: new Date(Date.now() + 7_200_000),
    applicationDeadlineAt: new Date(Date.now() + 900_000), items: [], applications: [],
    subtotal: 100000, serviceFee: 0, totalAmount: 100000,
  };

  function setup(profileId = 'preferred-profile') {
    const prisma: any = {
      booking: {
        findMany: jest.fn().mockResolvedValue([booking]), count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(booking),
      },
      technicianProfile: { findFirst: jest.fn().mockResolvedValue({ id: profileId }) },
      bookingTechnicianApplication: { findUnique: jest.fn().mockResolvedValue(null) },
      notification: { findMany: jest.fn().mockResolvedValue([]) },
      serviceCatalogPriceOption: { findMany: jest.fn().mockResolvedValue([{ id: 'option', durationMinutes: 60 }]) },
      technicianService: { findMany: jest.fn().mockResolvedValue([
        { catalogServiceId: 'catalog', priceOptions: [{ durationMinutes: 60 }] },
      ]) },
    };
    const service = new BookingsService(prisma, { get: (_key: string, fallback: unknown) => fallback } as any,
      {} as any, {} as any);
    jest.spyOn(service as any, 'assertOpenEligibility').mockResolvedValue(undefined);
    jest.spyOn(service, 'detail').mockResolvedValue(booking);
    return { service, prisma };
  }

  it('preserves the customer request when publishing the booking to the marketplace', async () => {
    const { service } = setup();
    const create = jest.spyOn(service, 'createOpen').mockResolvedValue({ bookingId: booking.id } as any);
    const dto = { technicianId: 'preferred-profile', items: [{ catalogServiceId: 'catalog', priceOptionId: 'option' }] };
    await service.createSelectedFromCatalog('customer-1', dto);
    expect(create).toHaveBeenCalledWith('customer-1', { items: dto.items }, 'preferred-profile', expect.any(Array));
  });

  it('stores the request separately without assigning the booking', async () => {
    const { service, prisma } = setup();
    prisma.serviceCatalogItem = { findMany: jest.fn().mockResolvedValue([
      { id: 'catalog', name: 'Massage', categoryId: 'category', category: { name: 'Massage' }, modes: ['ONSITE'],
        priceOptions: [{ id: 'option', durationMinutes: 60, price: 100000 }] },
    ]) };
    prisma.booking.create = jest.fn().mockResolvedValue(booking);
    prisma.$transaction = jest.fn((callback: any) => callback(prisma));
    // One waiting booking per customer: lock, then no other waiting booking found.
    prisma.$queryRaw = jest.fn().mockResolvedValue([]);
    prisma.booking.findFirst ??= jest.fn().mockResolvedValue(null);
    jest.spyOn(service as any, 'notifyEligibleTechniciansForOpenBooking').mockResolvedValue(undefined);
    const response = await service.createOpen('customer-1', {
      items: [{ catalogServiceId: 'catalog', priceOptionId: 'option' }],
      scheduledStart: new Date(Date.now() + 3_600_000).toISOString(),
      mode: 'ONSITE', city: 'HN', paymentMethod: 'CASH',
    } as any, 'preferred-profile');
    const data = prisma.booking.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ requestedTechnicianId: 'preferred-profile', assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN' });
    expect(data.technicianId).toBeUndefined();
    expect(response.requestedTechnicianId).toBe('preferred-profile');
  });

  it.each([
    ['preferred-profile', true, 'CUSTOMER_REQUEST', 'Khách đặt bạn'],
    ['other-profile', false, 'MARKETPLACE', 'Yêu cầu mới'],
  ])('returns consistent list and detail labels for %s', async (profileId, expected, requestType, requestLabel) => {
    const { service } = setup(profileId as string);
    const list = await service.listTechnicianJobs('technician-user', { page: 1, limit: 20 } as any);
    const detail = await service.technicianJobDetail('technician-user', booking.id);
    for (const response of [list.items[0], detail]) {
      expect(response).toMatchObject({
        requestedTechnicianId: 'preferred-profile', isRequestedTechnician: expected,
        requestType, requestLabel, canApply: true, applicationStatus: null,
        isSelected: false, isApplicant: false, canDecline: expected,
      });
    }
  });

  it('does not mistake the final assignee for the original requested technician', () => {
    const { service } = setup();
    const response = (service as any).openBookingResponse(
      { ...booking, status: 'CONFIRMED', technicianId: 'other-profile' }, 'SELECTED', true, true, 'other-profile',
    );
    expect(response).toMatchObject({ isRequestedTechnician: false, requestType: 'MARKETPLACE', canApply: false, canContact: true });
  });

  it('does not invent a requested recipient for old marketplace bookings', () => {
    const { service } = setup();
    const response = (service as any).openBookingResponse(
      { ...booking, requestedTechnicianId: undefined }, null, false, true, 'preferred-profile',
    );
    expect(response).toMatchObject({ requestedTechnicianId: null, isRequestedTechnician: false, requestLabel: 'Yêu cầu mới' });
  });

  it('keeps the initial request label while the technician is applying', () => {
    const { service } = setup();
    const response = (service as any).openBookingResponse(booking, 'APPLIED', false, false, 'preferred-profile');
    expect(response).toMatchObject({
      requestType: 'CUSTOMER_REQUEST', isRequestedTechnician: true,
      isSelected: false, isApplicant: true, canApply: false, canDecline: false, canWithdraw: true,
    });
  });

  it('checks open job eligibility against catalog-backed items when opening detail', async () => {
    const { service, prisma } = setup();
    const withCatalog = { ...booking, items: [{ catalogServiceId: 'catalog', catalogService: { id: 'catalog' } }] };
    prisma.booking.findUnique = jest.fn().mockResolvedValue(withCatalog);
    const response = await service.technicianJobDetail('tech-user', booking.id);
    expect(prisma.booking.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      include: { items: { include: { catalogService: true } } },
    }));
    expect((service as any).assertOpenEligibility).toHaveBeenCalledWith(prisma, withCatalog, 'preferred-profile');
    expect(response).toMatchObject({ canApply: true, canDecline: true });
  });

  it('lets a marketplace technician decline an open job they are not assigned to', async () => {
    const { service } = setup();
    const decline = jest.spyOn(service, 'declineOpenJob').mockResolvedValue({ status: 'DECLINED' } as any);
    await service.declineTechnicianJob('tech-user', booking.id, {} as any);
    expect(service.detail).toHaveBeenCalledWith('tech-user', booking.id, true, true);
    expect(decline).toHaveBeenCalledWith('tech-user', booking.id);
  });

  it('notifies the requested technician as "Khách đặt bạn" and others as "Yêu cầu mới"', async () => {
    const prisma: any = {
      technicianProfile: { findMany: jest.fn().mockResolvedValue([
        { id: 'preferred-profile', userId: 'preferred-user' },
        { id: 'other-profile', userId: 'other-user' },
      ]) },
    };
    const notifications = {
      getTemplate: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      sendPush: jest.fn().mockResolvedValue({}),
    };
    const service = new BookingsService(prisma, { get: (_key: string, fallback: unknown) => fallback } as any,
      notifications as any, {} as any);
    jest.spyOn(service as any, 'assertOpenEligibility').mockResolvedValue(undefined);
    await (service as any).notifyEligibleTechniciansForOpenBooking(booking);
    expect(notifications.create).toHaveBeenCalledWith(
      'preferred-user', 'OPEN_BOOKING_REQUESTED', 'Khách đặt bạn', expect.any(String), 'matxa://bookings/booking-1');
    expect(notifications.create).toHaveBeenCalledWith(
      'other-user', 'OPEN_BOOKING_AVAILABLE', 'Yêu cầu mới', expect.any(String), 'matxa://bookings/booking-1');
    expect(notifications.sendPush).toHaveBeenCalledWith('preferred-user', 'Khách đặt bạn', expect.any(String), {
      type: 'OPEN_BOOKING_REQUESTED', bookingId: 'booking-1', requestType: 'CUSTOMER_REQUEST', requestLabel: 'Khách đặt bạn',
    });
    expect(notifications.sendPush).toHaveBeenCalledWith('other-user', 'Yêu cầu mới', expect.any(String), {
      type: 'OPEN_BOOKING_AVAILABLE', bookingId: 'booking-1', requestType: 'MARKETPLACE', requestLabel: 'Yêu cầu mới',
    });
  });

  it('notifies everyone as "Yêu cầu mới" when the customer picked no technician', async () => {
    const prisma: any = {
      technicianProfile: { findMany: jest.fn().mockResolvedValue([{ id: 'preferred-profile', userId: 'preferred-user' }]) },
    };
    const notifications = { getTemplate: jest.fn().mockResolvedValue(null), create: jest.fn(), sendPush: jest.fn() };
    const service = new BookingsService(prisma, { get: (_key: string, fallback: unknown) => fallback } as any,
      notifications as any, {} as any);
    jest.spyOn(service as any, 'assertOpenEligibility').mockResolvedValue(undefined);
    await (service as any).notifyEligibleTechniciansForOpenBooking({ ...booking, requestedTechnicianId: null });
    expect(notifications.create).toHaveBeenCalledWith(
      'preferred-user', 'OPEN_BOOKING_AVAILABLE', 'Yêu cầu mới', expect.any(String), expect.any(String));
  });

  it('lets the requested technician open the job from an OPEN_BOOKING_REQUESTED notification', async () => {
    const prisma: any = {
      booking: { findUnique: jest.fn().mockResolvedValue({ ...booking, technician: null }) },
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'TECHNICIAN' }) },
      notification: { findFirst: jest.fn().mockResolvedValue({ id: 'n1' }) },
    };
    const service = new BookingsService(prisma, { get: (_key: string, fallback: unknown) => fallback } as any,
      {} as any, {} as any);
    await service.detail('preferred-user', booking.id, true, true).catch(() => undefined);
    expect(prisma.notification.findFirst.mock.calls[0][0].where.type.in).toContain('OPEN_BOOKING_REQUESTED');
  });

  it('marks a finalized alternative separately from the initial request', () => {
    const { service } = setup();
    const response = (service as any).openBookingResponse(
      { ...booking, status: 'CONFIRMED', technicianId: 'other-profile' }, 'SELECTED', true, false, 'other-profile',
    );
    expect(response).toMatchObject({
      requestType: 'MARKETPLACE', isRequestedTechnician: false,
      isSelected: true, isApplicant: false, canApply: false, canDecline: false,
    });
  });
});
