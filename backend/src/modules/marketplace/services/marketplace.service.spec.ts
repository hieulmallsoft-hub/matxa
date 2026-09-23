import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';

describe('MarketplaceService', () => {
  const technicianProfile = { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() };
  const favorite = { findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() };
  const $queryRaw = jest.fn();
  const tx = { technicianProfile, favorite, $queryRaw };
  const prisma = { ...tx, $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
  const service = new MarketplaceService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    $queryRaw.mockResolvedValue([{ total: 0n, ranked: [] }]);
    favorite.findMany.mockResolvedValue([]);
  });

  it('requires latitude and longitude together', async () => {
    await expect(service.searchTechnicians({ latitude: 21, page: 1, limit: 20 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sorts technicians by distance from the customer', async () => {
    $queryRaw.mockResolvedValue([{ total: 2n, ranked: [{ id: 'near', distance: 1.112 }, { id: 'far', distance: 22.24 }] }]);
    technicianProfile.findMany.mockResolvedValue([
      { id: 'far', userId: 'u2', user: {}, tags: [], serviceModes: [], isVerified: true, isAvailable: true, averageRating: 5, reviewCount: 1, city: 'Ha Noi', services: [], latitude: 21.2, longitude: 105.8 },
      { id: 'near', userId: 'u1', user: {}, tags: [], serviceModes: [], isVerified: true, isAvailable: true, averageRating: 4, reviewCount: 1, city: 'Ha Noi', services: [], latitude: 21.01, longitude: 105.8 },
    ]);
    const result = await service.searchTechnicians({ latitude: 21, longitude: 105.8, page: 1, limit: 20 });
    expect(result.items.map((item) => item.id)).toEqual(['near', 'far']);
    expect(result.items[0].distanceKm).toBe(1.1);
    expect(result.items[0].isFavorite).toBe(false);
    expect(favorite.findMany).not.toHaveBeenCalled();
    expect($queryRaw.mock.calls[0][0].text).toContain('distance ASC NULLS LAST');
    expect(technicianProfile.findMany.mock.calls[0][0].where).toEqual({ id: { in: ['near', 'far'] } });
  });

  it('keeps empty-page totals and parameterizes filters with a single service predicate', async () => {
    $queryRaw.mockResolvedValue([{ total: 25n, ranked: [] }]);
    const result = await service.searchTechnicians({ page: 4, limit: 10, keyword: "O'Brien%", available: false,
      gender: 'FEMALE', tag: 'legacy', tags: ['massage'], categoryId: '10000000-0000-4000-8000-000000000001',
      serviceId: '10000000-0000-4000-8000-000000000002', mode: 'HOME' });
    expect(result).toEqual({ items: [], total: 25, page: 4, limit: 10 });
    const sql = $queryRaw.mock.calls[0][0];
    expect(sql.text).not.toContain("O'Brien");
    expect(sql.values).toContain("%O'Brien\\%%");
    expect(sql.values).toContain(false);
    expect(sql.values).toContain('massage');
    expect(sql.text).toContain('p.is_active = true');
    expect(sql.text).toContain("u.status = 'ACTIVE'");
    expect(sql.text).toContain('s.is_active = true');
    expect(sql.text).toContain('c.is_active = true');
    expect(sql.text).toContain('is_available DESC, average_rating DESC, id ASC');
    expect(technicianProfile.findMany).not.toHaveBeenCalled();
  });

  it('scopes favorites to the authenticated user and orders matching services by price', async () => {
    $queryRaw.mockResolvedValue([{ total: 1n, ranked: [{ id: 't1', distance: null }] }]);
    technicianProfile.findMany.mockResolvedValue([{ id: 't1', userId: 'u1', user: { displayName: 'Name', avatarUrl: null },
      gender: null, tags: [], serviceModes: ['HOME'], isVerified: false, isAvailable: true, averageRating: 4,
      reviewCount: 2, city: null, services: [{ price: '150000' }] }]);
    favorite.findMany.mockResolvedValue([{ technicianId: 't1' }]);
    const result = await service.searchTechnicians({ page: 1, limit: 20, mode: 'HOME' }, 'customer');
    expect(result.items[0]).toMatchObject({ id: 't1', technicianId: 't1', isFavorite: true, startingPrice: 150000, distanceKm: null });
    expect(favorite.findMany).toHaveBeenCalledWith({ where: { userId: 'customer', technicianId: { in: ['t1'] } }, select: { technicianId: true } });
    expect(technicianProfile.findMany.mock.calls[0][0].include.services).toMatchObject({
      where: { isActive: true, category: { isActive: true }, modes: { has: 'HOME' } }, orderBy: [{ price: 'asc' }, { id: 'asc' }], take: 1,
    });
  });

  it('rejects invalid coordinates before querying', async () => {
    await expect(service.searchTechnicians({ page: 1, limit: 20, latitude: NaN, longitude: 0 })).rejects.toBeInstanceOf(BadRequestException);
    expect($queryRaw).not.toHaveBeenCalled();
  });

  it('does not favorite a missing technician', async () => {
    technicianProfile.findUnique.mockResolvedValue(null);
    await expect(service.addFavorite('user-1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
