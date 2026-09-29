import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminMarketplaceService } from './admin-marketplace.service';

describe('AdminMarketplaceService', () => {
  const db = {
    booking: { count: jest.fn(), aggregate: jest.fn(), findMany: jest.fn() },
    technicianProfile: { count: jest.fn(), findMany: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn() },
    review: { aggregate: jest.fn() },
    user: { findMany: jest.fn(), count: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    serviceCategory: { findMany: jest.fn(), create: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
    homeBanner: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
    promotion: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new AdminMarketplaceService(db as never);

  beforeEach(() => {
    jest.resetAllMocks();
    db.booking.count.mockResolvedValue(4);
    db.booking.aggregate.mockResolvedValue({ _sum: { totalAmount: 1250000 }, _count: { id: 3 } });
    db.technicianProfile.count.mockResolvedValue(2);
    db.review.aggregate.mockResolvedValue({ _avg: { rating: 4.5 }, _count: { rating: 10 } });
  });

  it('returns dashboard aggregates from database values', async () => {
    await expect(service.dashboard()).resolves.toEqual({
      todayBookings: 4, activeTechnicians: 2, averageRating: 4.5, reviewCount: 10,
      completedBookingsThisMonth: 3, revenueThisMonth: 1250000,
    });
    expect(db.technicianProfile.count).toHaveBeenCalledWith({ where: { isActive: true, isVerified: true, user: { status: 'ACTIVE' } } });
  });

  it('filters and maps users without returning identity secrets', async () => {
    db.user.findMany.mockResolvedValue([{ id: 'u1', displayName: 'A', role: 'CUSTOMER', status: 'ACTIVE', identities: [{ provider: 'EMAIL', email: 'a@test.dev', phoneNumber: null }] }]);
    db.user.count.mockResolvedValue(1);
    const result = await service.users({ page: 2, limit: 5, search: 'a', role: 'CUSTOMER', status: 'ACTIVE' });
    expect(result).toMatchObject({ total: 1, page: 2, limit: 5, items: [{ id: 'u1', email: 'a@test.dev', providers: ['EMAIL'] }] });
    expect(result.items[0]).not.toHaveProperty('passwordHash');
  });

  it('does not allow the current admin to lock themselves', async () => {
    await expect(service.updateUserStatus('admin', 'admin', { status: 'BLOCKED' })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it('maps missing records to not found and safely deactivates categories', async () => {
    db.serviceCategory.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.deactivateCategory('missing')).rejects.toBeInstanceOf(NotFoundException);
    db.serviceCategory.updateMany.mockResolvedValue({ count: 1 });
    await expect(service.deactivateCategory('cat-1')).resolves.toBeUndefined();
    expect(db.serviceCategory.updateMany).toHaveBeenLastCalledWith({ where: { id: 'cat-1' }, data: { isActive: false } });
  });

  it('validates banner and promotion date/value rules before writing', async () => {
    expect(() => service.createBanner('admin', { title: 'x', imageUrl: 'https://x.test', startsAt: '2026-10-02', endsAt: '2026-10-01' })).toThrow(BadRequestException);
    expect(() => service.createPromotion('admin', { code: 'x', name: 'x', type: 'PERCENT', value: 101, startsAt: '2026-10-01', endsAt: '2026-10-02' })).toThrow(BadRequestException);
    expect(db.homeBanner.create).not.toHaveBeenCalled();
    expect(db.promotion.create).not.toHaveBeenCalled();
  });

  it('normalizes promotion codes before persisting', async () => {
    db.promotion.create.mockResolvedValue({ id: 'p1' });
    await service.createPromotion('admin', { code: ' welcome ', name: 'Welcome', type: 'FIXED', value: 50000, startsAt: '2026-10-01', endsAt: '2026-10-02' });
    expect(db.promotion.create.mock.calls[0][0].data).toMatchObject({ code: 'WELCOME', value: 50000 });
  });
});
