import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AdminMarketplaceService } from './admin-marketplace.service';

describe('AdminMarketplaceService', () => {
  const db = {
    booking: { count: jest.fn(), aggregate: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
    technicianProfile: {
      count: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    review: { aggregate: jest.fn() },
    user: { findMany: jest.fn(), count: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    serviceCategory: { findMany: jest.fn(), create: jest.fn(), updateMany: jest.fn(), findUnique: jest.fn() },
    homeBanner: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    promotion: { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    systemSetting: { findMany: jest.fn() },
    userSuspension: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new AdminMarketplaceService(db as never);

  beforeEach(() => {
    jest.resetAllMocks();
    db.booking.count.mockResolvedValue(4);
    db.booking.aggregate.mockResolvedValue({ _sum: { platformFee: 1250000 }, _count: { id: 3 } });
    db.technicianProfile.count.mockResolvedValue(2);
    db.review.aggregate.mockResolvedValue({ _avg: { rating: 4.5 }, _count: { rating: 10 } });
    db.systemSetting.findMany.mockResolvedValue([]);
    db.booking.findMany.mockResolvedValue([]);
    db.userSuspension.findMany.mockResolvedValue([]);
  });

  it('returns dashboard aggregates from database values', async () => {
    await expect(service.dashboard()).resolves.toEqual({
      todayBookings: 4,
      activeTechnicians: 2,
      averageRating: 4.5,
      reviewCount: 10,
      completedBookingsThisMonth: 3,
      revenueThisMonth: 1250000,
    });
    expect(db.technicianProfile.count).toHaveBeenCalledWith({
      where: { isActive: true, isVerified: true, user: { status: 'ACTIVE' } },
    });
  });

  it('reports commission from completed bookings as revenue', async () => {
    db.booking.aggregate.mockResolvedValue({ _sum: { platformFee: 225000, totalAmount: 900000 } });
    db.booking.findMany.mockResolvedValue([
      {
        scheduledStart: new Date('2026-11-02T09:00:00+07:00'),
        totalAmount: 500000,
        platformFee: 125000,
        addressSnapshot: { city: 'Hà Nội' },
        technicianId: null,
        technician: null,
        items: [{ serviceName: 'Massage', categoryName: 'Massage', durationMinutes: 60 }],
      },
    ]);
    db.booking.groupBy
      .mockResolvedValueOnce([{ status: 'COMPLETED', _count: { _all: 1 } }, { status: 'CANCELLED', _count: { _all: 1 } }])
      .mockResolvedValueOnce([]);
    const report = await service.revenueReport('month', new Date('2026-11-03T10:00:00+07:00'));
    expect(report.kpis).toMatchObject({
      totalRevenue: 225000,
      totalOrderValue: 900000,
      revenueThisMonth: 125000,
      orderValueThisMonth: 500000,
      completionRate: 50,
    });
    expect(db.booking.aggregate).toHaveBeenCalledWith({ where: { status: 'COMPLETED' }, _sum: { platformFee: true, totalAmount: true } });
    expect(db.booking.findMany.mock.calls[0][0].where.status).toBe('COMPLETED');
  });

  it('filters and maps users without returning identity secrets', async () => {
    db.user.findMany.mockResolvedValue([
      {
        id: 'u1',
        displayName: 'A',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        identities: [{ provider: 'EMAIL', email: 'a@test.dev', phoneNumber: null }],
      },
    ]);
    db.user.count.mockResolvedValue(1);
    const result = await service.users({ page: 2, limit: 5, search: 'a', role: 'CUSTOMER', status: 'ACTIVE' });
    expect(result).toMatchObject({
      total: 1,
      page: 2,
      limit: 5,
      items: [{ id: 'u1', email: 'a@test.dev', providers: ['EMAIL'] }],
    });
    expect(result.items[0]).not.toHaveProperty('passwordHash');
  });

  it('matches users by exact id only when the search term is a UUID', async () => {
    db.user.findMany.mockResolvedValue([]);
    db.user.count.mockResolvedValue(0);
    const id = '3F2504E0-4F89-11D3-9A0C-0305E82C3301';
    await service.users({ page: 1, limit: 10, search: ` ${id} ` });
    const uuidWhere = db.user.findMany.mock.calls[0][0].where;
    expect(uuidWhere.OR[0]).toEqual({ id });
    expect(uuidWhere.OR).toHaveLength(4);
    expect(db.user.count).toHaveBeenCalledWith({ where: uuidWhere });

    await service.users({ page: 1, limit: 10, search: '3f2504e0' });
    const textWhere = db.user.findMany.mock.calls[1][0].where;
    expect(textWhere.OR).toHaveLength(3);
    expect(textWhere.OR).not.toContainEqual(expect.objectContaining({ id: expect.anything() }));
  });

  it('does not allow the current admin to lock themselves', async () => {
    await expect(service.updateUserStatus('admin', 'admin', { status: 'BLOCKED' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it('maps missing records to not found and safely deactivates categories', async () => {
    db.serviceCategory.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.deactivateCategory('missing')).rejects.toBeInstanceOf(NotFoundException);
    db.serviceCategory.updateMany.mockResolvedValue({ count: 1 });
    await expect(service.deactivateCategory('cat-1')).resolves.toBeUndefined();
    expect(db.serviceCategory.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'cat-1' },
      data: { isActive: false },
    });
  });

  it('validates banner and promotion date/value rules before writing', async () => {
    expect(() =>
      service.createBanner('admin', {
        title: 'x',
        imageUrl: 'https://x.test',
        startsAt: '2026-10-02',
        endsAt: '2026-10-01',
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      service.createPromotion('admin', {
        code: 'x',
        name: 'x',
        type: 'PERCENT',
        value: 101,
        startsAt: '2026-10-01',
        endsAt: '2026-10-02',
      }),
    ).toThrow(BadRequestException);
    expect(db.homeBanner.create).not.toHaveBeenCalled();
    expect(db.promotion.create).not.toHaveBeenCalled();
  });

  it('normalizes promotion codes before persisting', async () => {
    db.promotion.create.mockResolvedValue({ id: 'p1' });
    await service.createPromotion('admin', {
      code: ' welcome ',
      name: 'Welcome',
      type: 'FIXED',
      value: 50000,
      startsAt: '2026-10-01',
      endsAt: '2026-10-02',
    });
    expect(db.promotion.create.mock.calls[0][0].data).toMatchObject({ code: 'WELCOME', value: 50000 });
  });

  it('keeps customerIds out of promotion columns for public and assigned vouchers', async () => {
    db.promotion.create.mockResolvedValue({ id: 'p1' });
    const base = {
      code: 'all', name: 'All', type: 'PERCENT' as const, value: 5,
      startsAt: '2026-11-01', endsAt: '2026-11-03',
    };
    await service.createPromotion('admin', { ...base, customerIds: [] });
    const publicData = db.promotion.create.mock.calls[0][0].data;
    expect(publicData).not.toHaveProperty('customerIds');
    expect(publicData).not.toHaveProperty('recipients');

    await service.createPromotion('admin', { ...base, customerIds: ['u1'] });
    const assignedData = db.promotion.create.mock.calls[1][0].data;
    expect(assignedData).not.toHaveProperty('customerIds');
    expect(assignedData.recipients).toEqual({ create: [{ userId: 'u1' }] });
  });

  it('reports a duplicate promotion code as a conflict', async () => {
    db.promotion.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.createPromotion('admin', {
        code: '292257', name: 'Dup', type: 'FIXED', value: 5, startsAt: '2026-11-01', endsAt: '2026-11-18',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
