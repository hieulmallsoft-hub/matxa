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

// Lỗi 6/11: khách nhập mã giảm giá khi đặt, nhưng đơn tạo ra (và chi tiết đơn sau khi KTV nhận) không có giảm giá.
describe('promotion code on an open booking', () => {
  const promotion = { id: 'promo-1', code: 'GIAM50', type: 'FIXED', value: 50_000, maxDiscount: null, minOrderAmount: 0, perUserLimit: 1, usageLimit: 10, usedCount: 0 };

  function setup(found: any = promotion, reserved = 1) {
    const prisma: any = {
      serviceCatalogItem: { findMany: jest.fn().mockResolvedValue([
        { id: 'catalog', name: 'Massage', categoryId: 'category', category: { name: 'Massage' }, modes: ['ONSITE'],
          priceOptions: [{ id: 'option', durationMinutes: 60, price: 400_000 }] },
      ]) },
      promotion: { findFirst: jest.fn().mockResolvedValue(found), updateMany: jest.fn().mockResolvedValue({ count: reserved }) },
      promotionUsage: { count: jest.fn().mockResolvedValue(0) },
      booking: { create: jest.fn(async ({ data }: any) => ({ id: 'booking-1', items: [], ...data })) },
    };
    prisma.$transaction = jest.fn((callback: any) => callback(prisma));
    // One waiting booking per customer: lock, then no other waiting booking found.
    prisma.$queryRaw = jest.fn().mockResolvedValue([]);
    prisma.booking.findFirst ??= jest.fn().mockResolvedValue(null);
    const service = new BookingsService(prisma, { get: (_key: string, fallback: unknown) => fallback } as any, {} as any, {} as any);
    jest.spyOn(service as any, 'notifyEligibleTechniciansForOpenBooking').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'openBookingResponse').mockReturnValue({});
    const dto: any = {
      items: [{ catalogServiceId: 'catalog', priceOptionId: 'option' }],
      scheduledStart: new Date(Date.now() + 86_400_000).toISOString(),
      mode: 'ONSITE', city: 'HN', paymentMethod: 'CASH', promotionCode: 'giam50',
    };
    return { service, prisma, dto };
  }

  it('stores the discount, the promotion and its use on the booking', async () => {
    const { service, prisma, dto } = setup();
    await service.createOpen('customer-1', dto);
    expect(prisma.promotion.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { usedCount: { increment: 1 } } }));
    const data = prisma.booking.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ promotionId: 'promo-1', discountAmount: 50_000, promotionUsage: { create: { promotionId: 'promo-1', userId: 'customer-1' } } });
    expect(Number(data.totalAmount)).toBe(350_000);
    expect(Number(data.customerPayableAmount)).toBe(350_000);
    expect(Number(data.payment.create.amount)).toBe(350_000);
  });

  it('refuses an invalid code instead of silently charging full price', async () => {
    const { service, prisma, dto } = setup(null);
    await expect(service.createOpen('customer-1', dto)).rejects.toThrow('Ma khuyen mai khong hop le hoac da het han');
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it('refuses when the last use was just taken by someone else', async () => {
    const { service, prisma, dto } = setup(promotion, 0);
    await expect(service.createOpen('customer-1', dto)).rejects.toThrow('Ma khuyen mai da het luot su dung');
    expect(prisma.booking.create).not.toHaveBeenCalled();
  });
});
