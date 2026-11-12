import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
// These cover other rules; the customer-only check has its own spec.
beforeEach(() => jest.spyOn(BookingsService.prototype as any, 'assertCustomer').mockResolvedValue(undefined));

// Admin-configured booking rules: minimum advance time and maximum dispatch radius (0 = no limit).
describe('booking rules from admin settings', () => {
  const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
  // Hanoi Opera House and two points ~5 km and ~25 km away.
  const customer = { latitude: 21.0245, longitude: 105.8575 };
  const near = { latitude: 21.0695, longitude: 105.8575 };
  const far = { latitude: 21.2493, longitude: 105.8575 };

  // The customer has no unfinished booking (checked first when creating one).
  const subject = (rules: { minAdvanceHours?: number; maxDispatchRadiusKm?: number }, prisma: any = { booking: { findFirst: jest.fn().mockResolvedValue(null) } }) => {
    const settings = {
      getBookingRules: jest.fn().mockResolvedValue({ minAdvanceHours: 0, maxDispatchRadiusKm: 0, ...rules }),
    };
    const config = { get: (_key: string, fallback: unknown) => fallback };
    return new BookingsService(
      prisma, config as any, {} as any, {} as any, undefined, undefined, undefined, settings as any,
    );
  };

  describe('minimum advance time', () => {
    it.each([
      ['an open marketplace booking', (service: any, start: string) => service.createOpen('customer-1', { scheduledStart: start })],
      ['a direct booking quote', (service: any, start: string) => service.quote('customer-1', { scheduledStart: start })],
      ['a technician search', (service: any, start: string) => service.matchingTechnicians('customer-1', { scheduledStart: start })],
    ])('rejects %s that starts too soon', async (_label, call) => {
      await expect(call(subject({ minAdvanceHours: 2 }), inHours(1))).rejects.toThrow(
        new BadRequestException('Vui long dat lich truoc it nhat 2 gio'),
      );
    });

    it('accepts a time far enough ahead', async () => {
      const service: any = subject({ minAdvanceHours: 2 });
      await expect(service.assertLeadTime(new Date(inHours(3)))).resolves.toBeUndefined();
    });

    it('does nothing when the rule is 0', async () => {
      const service: any = subject({ minAdvanceHours: 0 });
      await expect(service.assertLeadTime(new Date(inHours(0.1)))).resolves.toBeUndefined();
    });
  });

  describe('maximum dispatch radius', () => {
    const booking = {
      id: 'booking-1', assignmentMode: 'OPEN_MARKETPLACE', status: 'OPEN', mode: 'HOME',
      addressSnapshot: { city: 'Ha Noi', ...customer },
      items: [{ catalogService: { id: 'catalog-1', categoryId: 'category-1' } }],
      scheduledStart: new Date(inHours(5)), scheduledEnd: new Date(inHours(6)),
    };
    const db = (location: { latitude: number | null; longitude: number | null }) => ({
      technicianProfile: {
        findFirst: jest.fn().mockResolvedValue({ id: 'tech-1', city: 'Ha Noi', district: null, serviceModes: ['HOME'], ...location }),
      },
      booking: { findFirst: jest.fn().mockResolvedValue(null) },
      technicianService: { findFirst: jest.fn().mockResolvedValue({ id: 'service-1' }) },
      availabilitySlot: { findFirst: jest.fn().mockResolvedValue({ id: 'slot-1' }) },
    });
    const check = (rules: object, location: any) => {
      const service: any = subject(rules);
      return service.assertOpenEligibility(db(location), booking, 'tech-1');
    };

    it('keeps a technician outside the radius from seeing or taking the booking', async () => {
      await expect(check({ maxDispatchRadiusKm: 10 }, far)).rejects.toThrow(
        new ForbiddenException('KTV ngoai ban kinh phuc vu cua don'),
      );
    });

    it('allows a technician inside the radius', async () => {
      await expect(check({ maxDispatchRadiusKm: 10 }, near)).resolves.not.toThrow();
    });

    it('allows everyone when the rule is 0 or the technician has no location yet', async () => {
      await expect(check({ maxDispatchRadiusKm: 0 }, far)).resolves.not.toThrow();
      await expect(check({ maxDispatchRadiusKm: 10 }, { latitude: null, longitude: null })).resolves.not.toThrow();
    });

    it('drops technicians outside the radius from the customer suggestions', async () => {
      const candidate = (id: string, location: object) => ({
        id, city: 'Ha Noi', district: null, averageRating: 5, reviewCount: 0, ...location,
        user: { id: `${id}-user`, displayName: id, avatarUrl: null },
      });
      const prisma = {
        serviceCatalogItem: { findMany: jest.fn().mockResolvedValue([{ id: 'catalog-1', categoryId: 'category-1' }]) },
        serviceCatalogPriceOption: { findMany: jest.fn().mockResolvedValue([{ id: 'option-1', durationMinutes: 60 }]) },
        technicianProfile: { findMany: jest.fn().mockResolvedValue([candidate('near', near), candidate('far', far)]) },
        availabilitySlot: { findFirst: jest.fn().mockResolvedValue({ id: 'slot-1' }) },
        booking: { findFirst: jest.fn().mockResolvedValue(null) },
        technicianService: { findMany: jest.fn().mockResolvedValue([{ catalogServiceId: 'catalog-1', categoryId: 'category-1' }]) },
      };
      const service = subject({ maxDispatchRadiusKm: 10 }, prisma);
      const result = await service.matchingTechnicians('customer-1', {
        scheduledStart: inHours(5), city: 'Ha Noi', mode: 'HOME', ...customer,
        items: [{ catalogServiceId: 'catalog-1', priceOptionId: 'option-1' }],
      });
      expect(result.items.map((item: any) => item.technicianId)).toEqual(['near']);
    });
  });
});
