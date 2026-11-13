import { BookingsService } from './bookings.service';
import { offeredServiceWhere } from '../../marketplace/services/technician-selection';
// Suspensions are covered by cancel-limit.spec; here nobody is suspended.
jest.mock('./cancel-limit', () => ({
  ...jest.requireActual('./cancel-limit'),
  activeSuspension: jest.fn().mockResolvedValue(null),
  assertNotSuspended: jest.fn().mockResolvedValue(undefined),
  applyCancelLimit: jest.fn().mockResolvedValue({ enabled: false, lockedUntil: null }),
}));
beforeEach(() => jest.spyOn(BookingsService.prototype as any, 'assertCustomer').mockResolvedValue(undefined));

const config = { get: (_k: string, f: unknown) => f } as any;
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const cities = { findMany: jest.fn().mockResolvedValue([{ code: 'HN', name: 'Hà Nội' }, { code: 'HCM', name: 'Hồ Chí Minh' }]) };
const districts = { findMany: jest.fn().mockResolvedValue([{ code: 'HN-PHUONG-HOAN-KIEM', name: 'Phường Hoàn Kiếm' }]) };

describe('online bookings are not tied to an area', () => {
  const eligibility = (mode: string) => {
    const service: any = new BookingsService({} as any, config, {} as any, {} as any);
    const db = {
      // A Ha Noi technician; the customer is in Ho Chi Minh City.
      technicianProfile: { findFirst: jest.fn().mockResolvedValue({ id: 'p1', userId: 'u1', city: 'HN', district: 'HN-PHUONG-DONG-DA', serviceModes: [mode], latitude: null, longitude: null, facility: 'X', address: 'Y' }) },
      booking: { findFirst: jest.fn().mockResolvedValue(null) },
      technicianService: { findFirst: jest.fn().mockResolvedValue({ id: 's1' }) },
      availabilitySlot: { findFirst: jest.fn().mockResolvedValue({ id: 'slot' }) },
    };
    const booking = { id: 'b1', customerId: 'c1', assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN', mode, addressSnapshot: { city: 'HCM', district: null },
      items: [{ catalogService: { id: 'cat', categoryId: 'cg' } }], scheduledStart: new Date(inHours(5)), scheduledEnd: new Date(inHours(6)) };
    return service.assertOpenEligibility(db, booking, 'p1');
  };

  it('lets a technician in another city take an ONLINE booking', async () => {
    await expect(eligibility('ONLINE')).resolves.not.toThrow();
  });

  it('still keeps home bookings to the customer city', async () => {
    await expect(eligibility('HOME')).rejects.toThrow('KTV khong phu hop khu vuc cua don');
  });

  it('does not filter suggested technicians by city for ONLINE', async () => {
    const prisma: any = {
      city: cities, district: districts,
      serviceCatalogItem: { findMany: jest.fn().mockResolvedValue([{ id: 'cat', categoryId: 'cg' }]) },
      serviceCatalogPriceOption: { findMany: jest.fn().mockResolvedValue([{ id: 'opt', durationMinutes: 60 }]) },
      technicianProfile: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new BookingsService(prisma, config, {} as any, {} as any);
    await service.matchingTechnicians('c1', { scheduledStart: inHours(5), city: 'HCM', mode: 'ONLINE', items: [{ catalogServiceId: 'cat', priceOptionId: 'opt' }] });
    expect(prisma.technicianProfile.findMany.mock.calls[0][0].where.city).toBeUndefined();
    await service.matchingTechnicians('c1', { scheduledStart: inHours(5), city: 'Ho Chi Minh', mode: 'HOME', items: [{ catalogServiceId: 'cat', priceOptionId: 'opt' }] });
    expect(prisma.technicianProfile.findMany.mock.calls[1][0].where.city).toBe('HCM');
  });
});

describe('the booking city must be a known one', () => {
  const create = (city: string, district?: string) => {
    const prisma: any = {
      city: cities, district: districts,
      booking: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      // Stop right after the area check.
      serviceCatalogItem: { findMany: jest.fn().mockRejectedValue(new Error('area accepted')) },
    };
    const service = new BookingsService(prisma, config, {} as any, {} as any);
    return service.createOpen('c1', { mode: 'ONLINE', scheduledStart: inHours(5), city, district, items: [{ catalogServiceId: 'cat', priceOptionId: 'opt' }], paymentMethod: 'CASH' } as any)
      .then(() => 'created', (e: any) => e.getResponse?.().code ?? e.message);
  };

  it('refuses an unknown city with INVALID_CITY instead of a booking nobody can see', async () => {
    await expect(create('XYZ')).resolves.toBe('INVALID_CITY');
    await expect(create('HN', 'Phuong Khong Co')).resolves.toBe('INVALID_DISTRICT');
  });

  it('accepts a code or a name', async () => {
    await expect(create('HN')).resolves.toBe('area accepted');
    await expect(create('Ha Noi', 'Hoan Kiem')).resolves.toBe('area accepted');
  });
});

it('older services without a catalog entry are not on offer (they cannot be booked)', () => {
  expect(offeredServiceWhere).toMatchObject({ catalogServiceId: { not: null } });
});
