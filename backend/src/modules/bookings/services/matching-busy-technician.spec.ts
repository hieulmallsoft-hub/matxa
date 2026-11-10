import { BookingsService } from './bookings.service';
// These cover other rules; the customer-only check has its own spec.
beforeEach(() => jest.spyOn(BookingsService.prototype as any, 'assertCustomer').mockResolvedValue(undefined));

// A technician with an unfinished confirmed booking cannot take another one, so the customer
// must not be offered them (they would pick them and get 409 when creating the booking).
describe('matching technicians', () => {
  it('leaves out technicians who still have an unfinished confirmed booking', async () => {
    const candidate = (id: string) => ({
      id, city: 'HN', district: null, latitude: null, longitude: null, averageRating: 5, reviewCount: 0,
      user: { id: `${id}-user`, displayName: id, avatarUrl: null },
    });
    const prisma: any = {
      serviceCatalogItem: { findMany: jest.fn().mockResolvedValue([{ id: 'catalog-1', categoryId: 'category-1' }]) },
      serviceCatalogPriceOption: { findMany: jest.fn().mockResolvedValue([{ id: 'option-1', durationMinutes: 90 }]) },
      technicianProfile: { findMany: jest.fn().mockResolvedValue([candidate('free'), candidate('busy')]) },
      availabilitySlot: { findFirst: jest.fn().mockResolvedValue({ id: 'slot' }) },
      // "busy" has a confirmed booking at another time that is not finished yet.
      booking: { findFirst: jest.fn(async ({ where }: any) => (where.technicianId === 'busy' && where.status === 'CONFIRMED' && !where.scheduledStart ? { id: 'other' } : null)) },
      technicianService: { findMany: jest.fn().mockResolvedValue([{ catalogServiceId: 'catalog-1', categoryId: 'category-1' }]) },
    };
    const service = new BookingsService(prisma, { get: (_k: string, f: unknown) => f } as any, {} as any, {} as any);
    const result = await service.matchingTechnicians('customer-1', {
      scheduledStart: new Date(Date.now() + 8 * 3_600_000).toISOString(), city: 'HN', mode: 'HOME',
      items: [{ catalogServiceId: 'catalog-1', priceOptionId: 'option-1' }],
    });
    expect(result.items.map((item: any) => item.technicianId)).toEqual(['free']);
  });
});
