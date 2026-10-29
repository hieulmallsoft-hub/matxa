import { BookingsService } from './bookings.service';

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
      booking: { findMany: jest.fn().mockResolvedValue([booking]), count: jest.fn().mockResolvedValue(1) },
      technicianProfile: { findFirst: jest.fn().mockResolvedValue({ id: profileId }) },
      bookingTechnicianApplication: { findUnique: jest.fn().mockResolvedValue(null) },
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
    expect(create).toHaveBeenCalledWith('customer-1', { items: dto.items }, 'preferred-profile');
  });

  it('stores the request separately without assigning the booking', async () => {
    const { service, prisma } = setup();
    prisma.serviceCatalogItem = { findMany: jest.fn().mockResolvedValue([
      { id: 'catalog', name: 'Massage', categoryId: 'category', category: { name: 'Massage' }, modes: ['ONSITE'],
        priceOptions: [{ id: 'option', durationMinutes: 60, price: 100000 }] },
    ]) };
    prisma.booking.create = jest.fn().mockResolvedValue(booking);
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
});
