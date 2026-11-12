import { BookingsService } from './bookings.service';

// A customer who books a chosen technician pays that technician's own price (what /quote showed), not the catalog's.
describe('booking with a chosen technician uses their price', () => {
  const catalog = {
    id: 'catalog-1', name: 'Phuc hoi van dong', categoryId: 'cat-1', category: { name: 'PT' }, modes: ['HOME'],
    priceOptions: [{ id: 'catalog-60', durationMinutes: 60, price: 500000 }, { id: 'catalog-90', durationMinutes: 90, price: 700000 }],
  };
  const lunaService = (priceOptions: any[], base = { durationMinutes: 60, price: 400000 }) => ({
    id: 'luna-service', technicianId: 'luna', catalogServiceId: 'catalog-1', isActive: true, modes: ['HOME'], ...base, priceOptions,
  });
  const lunaOptions = [{ id: 'luna-60', technicianServiceId: 'luna-service', code: '60_MINUTES', durationMinutes: 60, price: 450000, isActive: true }];

  const subject = (service: any) => {
    const prisma: any = {
      serviceCatalogItem: { findMany: jest.fn().mockResolvedValue([catalog]) },
      serviceCatalogPriceOption: { findMany: jest.fn(async ({ where }: any) => catalog.priceOptions.filter((o) => where.id.in.includes(o.id))) },
      technicianService: { findMany: jest.fn().mockResolvedValue([service]) },
      technicianServicePriceOption: { findMany: jest.fn(async ({ where }: any) => service.priceOptions.filter((o: any) => where.id.in.includes(o.id))) },
      address: { findFirst: jest.fn().mockResolvedValue({ id: 'addr', address: 'A', phone: null, latitude: 21, longitude: 105, label: null }) },
      booking: { create: jest.fn(async ({ data }: any) => ({ id: 'b1', ...data, items: data.items.create })), findFirst: jest.fn().mockResolvedValue(null) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    prisma.$transaction = jest.fn((callback: any) => callback(prisma));
    const bookings = new BookingsService(prisma, { get: (_k: string, f: unknown) => f } as any, {} as any, {} as any);
    jest.spyOn(bookings as any, 'assertCustomer').mockResolvedValue(undefined);
    jest.spyOn(bookings as any, 'assertOpenEligibility').mockResolvedValue(undefined);
    jest.spyOn(bookings as any, 'notifyEligibleTechniciansForOpenBooking').mockResolvedValue(undefined);
    jest.spyOn(bookings as any, 'openBookingResponse').mockImplementation((b: any) => b);
    const book = (priceOptionId: string) => bookings.createSelectedFromCatalog('customer-1', {
      technicianId: 'luna', mode: 'HOME', addressId: 'addr', city: 'HN', paymentMethod: 'CASH',
      scheduledStart: new Date(Date.now() + 5 * 3_600_000).toISOString(),
      items: [{ catalogServiceId: 'catalog-1', priceOptionId }],
    });
    return { prisma, book };
  };

  it("charges Luna's 450.000 for the 60-minute package and records her service and package", async () => {
    const { prisma, book } = subject(lunaService(lunaOptions));
    await book('catalog-60');
    const data = prisma.booking.create.mock.calls[0][0].data;
    expect(Number(data.subtotal)).toBe(450000);
    expect(data.items.create[0]).toMatchObject({
      serviceId: 'luna-service', priceOptionId: 'luna-60', catalogPriceOptionId: 'catalog-60', durationMinutes: 60, unitPrice: 450000,
    });
  });

  it('uses the base price of a technician without packages when the length matches', async () => {
    const { prisma, book } = subject(lunaService([]));
    await book('catalog-60');
    expect(prisma.booking.create.mock.calls[0][0].data.items.create[0]).toMatchObject({ serviceId: 'luna-service', priceOptionId: null, unitPrice: 400000 });
  });

  it('refuses a length the technician does not sell instead of charging another price', async () => {
    const { prisma, book } = subject(lunaService(lunaOptions));
    await expect(book('catalog-90')).rejects.toThrow('KTV khong co goi 90 phut cho dich vu nay');
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });
});
