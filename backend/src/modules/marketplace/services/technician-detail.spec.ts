import { NotFoundException } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';

describe('Public technician detail contract', () => {
  const findUnique = jest.fn();
  const favorite = { findUnique: jest.fn() };
  const service = new MarketplaceService({ technicianProfile: { findUnique }, favorite } as never);
  const offering = (id: string, modes: string[], active = true, categoryActive = true) => ({
    id, technicianId: 'profile', categoryId: 'category', name: id, description: null,
    price: '150000.00', durationMinutes: 60, modes, isActive: active,
    category: { id: 'category', name: 'Massage', isActive: categoryActive },
  });
  let row: any;
  beforeEach(() => {
    jest.resetAllMocks();
    row = { id: 'profile', userId: 'different-user-id', bio: null, gender: null, tags: [], serviceModes: ['HOME'],
      latitude: null, longitude: null, city: null, address: 'Studio', isVerified: true, isActive: true,
      isAvailable: false, averageRating: '4.50', reviewCount: 25,
      user: { id: 'different-user-id', status: 'ACTIVE', displayName: 'Lan', avatarUrl: null, email: 'private', passwordHash: 'private' },
      services: [offering('home', ['HOME']), offering('onsite', ['ONSITE']), offering('online', ['ONLINE']),
        offering('disabled', ['HOME'], false), offering('hidden-category', ['HOME'], true, false)],
      reviews: Array.from({ length: 25 }, (_, i) => ({ id: String(i), rating: 5, comment: null,
        createdAt: new Date(2026, 0, i + 1), user: { id: 'customer', displayName: 'Customer', avatarUrl: null, phone: 'private' } })),
    };
    // Query-aware test double; real PostgreSQL integration is a separate deployment check.
    findUnique.mockImplementation(async ({ where, select }) => {
      expect(where).toMatchObject({ id: 'profile', isActive: true, isVerified: true, user: { status: 'ACTIVE' },
        services: { some: { isActive: true, category: { isActive: true } } } });
      const active = row.services.filter((s: any) => s.isActive && s.category.isActive);
      if (!row.isActive || !row.isVerified || row.user.status !== 'ACTIVE' || !active.length) return null;
      expect(select.services.where).toEqual({ isActive: true, category: { isActive: true } });
      expect(select.reviews).toMatchObject({ take: 20, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      const publicUser = (user: any, selection: any) => Object.fromEntries(Object.keys(selection).map(k => [k, user[k]]));
      return { ...row, user: publicUser(row.user, select.user.select), services: active,
        reviews: [...row.reviews].sort((a: any, b: any) => +b.createdAt - +a.createdAt).slice(0, select.reviews.take)
          .map((r: any) => ({ ...r, user: publicUser(r.user, select.reviews.include.user.select) })) };
    });
    favorite.findUnique.mockResolvedValue(null);
  });

  it('allows guests, uses profile ID and unions only active categorized service modes', async () => {
    const result = await service.technicianDetail('profile');
    expect(result).toMatchObject({ technicianId: 'profile', userId: 'different-user-id', isFavorite: false,
      rating: 4.5, averageRating: 4.5, reviewCount: 25, nextAvailableAt: null, supportedModes: ['HOME', 'ONSITE', 'ONLINE'] });
    expect(result.services.map(s => s.technicianServiceId)).toEqual(['home', 'onsite', 'online']);
    expect(result.services[0]).toMatchObject({ serviceId: 'home', categoryName: 'Massage', supportedModes: ['HOME'], price: 150000 });
    expect(favorite.findUnique).not.toHaveBeenCalled();
  });

  it.each([true, false])('returns current-user favorite state %s', async found => {
    favorite.findUnique.mockResolvedValue(found ? { technicianId: 'profile' } : null);
    expect((await service.technicianDetail('profile', {}, 'viewer')).isFavorite).toBe(found);
    expect(favorite.findUnique).toHaveBeenCalledTimes(1);
    expect(favorite.findUnique).toHaveBeenCalledWith({ where: { userId_technicianId: { userId: 'viewer', technicianId: 'profile' } }, select: { technicianId: true } });
  });

  it.each(['unverified', 'inactive', 'locked', 'inactive-user', 'no-active-service', 'inactive-category'])('hides %s profiles', async state => {
    if (state === 'unverified') row.isVerified = false;
    if (state === 'inactive') row.isActive = false;
    if (state === 'locked') row.user.status = 'BLOCKED';
    if (state === 'inactive-user') row.user.status = 'INACTIVE';
    if (state === 'no-active-service') row.services.forEach((s: any) => s.isActive = false);
    if (state === 'inactive-category') row.services.forEach((s: any) => s.category.isActive = false);
    await expect(service.technicianDetail('profile')).rejects.toBeInstanceOf(NotFoundException);
    expect(favorite.findUnique).not.toHaveBeenCalled();
  });

  it('embeds only 20 newest reviews with public user fields and uses stored aggregates', async () => {
    const result = await service.technicianDetail('profile');
    expect(result.reviews).toHaveLength(20);
    expect(result.reviews.map(r => r.id)).toEqual(Array.from({ length: 20 }, (_, i) => String(24 - i)));
    expect(result.reviewCount).toBe(25);
    expect(result.user).toEqual({ id: 'different-user-id', displayName: 'Lan', avatarUrl: null });
    expect(JSON.stringify(result)).not.toContain('private');
    expect(findUnique).toHaveBeenCalledTimes(1);
  });
});
