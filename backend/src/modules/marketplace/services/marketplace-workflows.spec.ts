import { MarketplaceService } from './marketplace.service';
import { publicTechnicianWhere } from './technician-selection';

describe('Technician detail, favorites, availability and address workflows', () => {
  const technicianProfile = { findUnique: jest.fn() };
  const technicianService = { findMany: jest.fn() };
  const availabilitySlot = { findMany: jest.fn() };
  const booking = { findMany: jest.fn() };
  const favorite = { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), findMany: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() };
  const address = { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() };
  const tx = { address, $queryRaw: jest.fn() };
  const prisma = { technicianProfile, technicianService, availabilitySlot, booking, favorite, address,
    $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)) };
  const service = new MarketplaceService(prisma as never);
  const profile = () => ({
    id: 't1', userId: 'tech-user', bio: 'Experience', user: { id: 'tech-user', displayName: 'Lan', avatarUrl: 'https://example.com/avatar.jpg' },
    averageRating: '4.50', reviewCount: 21, tags: ['yoga'], serviceModes: ['HOME', 'ONSITE'], isVerified: false,
    isActive: true, isAvailable: true, gender: 'FEMALE', city: 'HCM', address: 'Studio', latitude: '10', longitude: '106',
    services: [{ id: 's1', price: '150000.00', durationMinutes: 60, modes: ['HOME', 'ONSITE'], category: { id: 'c1', isActive: true } }],
    reviews: [],
  });
  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(async (fn) => fn(tx));
    technicianProfile.findUnique.mockResolvedValue(profile());
    favorite.findUnique.mockResolvedValue(null);
  });

  it('returns public detail with bookable service IDs, numeric prices, location and favorites', async () => {
    favorite.findUnique.mockResolvedValue({ technicianId: 't1' });
    const result = await service.technicianDetail('t1', { latitude: 10, longitude: 106 }, 'customer');
    expect(result).toMatchObject({ technicianId: 't1', distanceKm: 0, isFavorite: true, images: ['https://example.com/avatar.jpg'],
      onsiteLocation: { address: 'Studio', latitude: 10, longitude: 106 },
      services: [{ id: 's1', serviceId: 's1', technicianServiceId: 's1', price: 150000, durationMinutes: 60 }] });
    expect(technicianProfile.findUnique.mock.calls[0][0]).toMatchObject({
      where: { id: 't1', ...publicTechnicianWhere }, include: {
        user: { select: { id: true, displayName: true, avatarUrl: true } },
        services: { where: { isActive: true, category: { isActive: true } } },
        reviews: { take: 20, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
      },
    });
    expect(result.user).not.toHaveProperty('email');
    expect(favorite.findUnique).toHaveBeenCalledWith({ where: { userId_technicianId: { userId: 'customer', technicianId: 't1' } }, select: { technicianId: true } });
  });

  it('allows guest detail; missing avatar/location return empty/null', async () => {
    technicianProfile.findUnique.mockResolvedValue({ ...profile(), latitude: null, user: { id: 'tech-user', displayName: null, avatarUrl: null }, serviceModes: ['HOME'] });
    const result = await service.technicianDetail('t1', { latitude: 10, longitude: 106 });
    expect(result).toMatchObject({ images: [], onsiteLocation: null, distanceKm: null, isFavorite: false });
    expect(favorite.findUnique).not.toHaveBeenCalled();
    await expect(service.technicianDetail('t1', { latitude: 10 })).rejects.toThrow();
    technicianProfile.findUnique.mockResolvedValue(null);
    await expect(service.technicianDetail('inactive')).rejects.toThrow('khong ton tai');
  });

  it('returns favorite cards and never touches booking data', async () => {
    favorite.findMany.mockResolvedValue([{ technician: profile() }]);
    const result = await service.favorites('customer');
    expect(result[0]).toMatchObject({ technicianId: 't1', displayName: 'Lan', averageRating: 4.5, isFavorite: true, startingPrice: 150000 });
    expect(favorite.findMany.mock.calls[0][0].where).toEqual({ userId: 'customer', technician: publicTechnicianWhere });
    favorite.upsert.mockResolvedValue({ userId: 'customer', technicianId: 't1' });
    await service.addFavorite('customer', 't1');
    await service.addFavorite('customer', 't1');
    expect(favorite.upsert).toHaveBeenLastCalledWith({ where: { userId_technicianId: { userId: 'customer', technicianId: 't1' } }, create: { userId: 'customer', technicianId: 't1' }, update: {} });
    await service.removeFavorite('customer', 't1');
    expect(favorite.deleteMany).toHaveBeenCalledWith({ where: { userId: 'customer', technicianId: 't1' } });
    expect(booking.findMany).not.toHaveBeenCalled();
  });

  it('handles concurrent favorite adds idempotently', async () => {
    favorite.upsert.mockRejectedValue({ code: 'P2002' });
    favorite.findUniqueOrThrow.mockResolvedValue({ userId: 'customer', technicianId: 't1' });
    await expect(service.addFavorite('customer', 't1')).resolves.toEqual({ userId: 'customer', technicianId: 't1' });
  });

  it('fetches occupied bookings once for computed slots, preserving legacy working schedules', async () => {
    const startAt = new Date('2099-10-01T08:00:00+07:00');
    const endAt = new Date('2099-10-01T12:00:00+07:00');
    availabilitySlot.findMany.mockResolvedValue([{ id: 'w1', startAt, endAt }]);
    technicianService.findMany.mockResolvedValue([{ id: 's1', durationMinutes: 60, modes: ['HOME'] }]);
    booking.findMany.mockResolvedValue([{ scheduledStart: new Date('2099-10-01T09:00:00+07:00'), scheduledEnd: new Date('2099-10-01T10:00:00+07:00') }]);
    const result = await service.availability('t1', { date: '2099-10-01', serviceIds: ['s1', 's1'], mode: 'HOME', stepMinutes: 30 });
    expect(result).toMatchObject({ durationMinutes: 60, timezone: 'Asia/Ho_Chi_Minh', serviceIds: ['s1'] });
    if (!Array.isArray(result)) expect(result.slots).toHaveLength(4);
    expect(booking.findMany).toHaveBeenCalledTimes(1);
    expect(booking.findMany.mock.calls[0][0].where).toMatchObject({ technicianId: 't1', status: { in: ['PENDING', 'CONFIRMED'] },
      scheduledStart: { lt: new Date('2099-10-01T17:00:00Z') }, scheduledEnd: { gt: new Date('2099-09-30T17:00:00Z') } });
    const legacy = await service.availability('t1', { from: startAt.toISOString(), to: endAt.toISOString(), stepMinutes: 30 });
    expect(legacy).toEqual([{ id: 'w1', startAt, endAt }]);
    expect(booking.findMany).toHaveBeenCalledTimes(1);
    await expect(service.availability('t1', { date: '2099-10-01', serviceIds: ['s1'], stepMinutes: 30 })).rejects.toThrow('mode');
  });

  it('serializes creation of defaults using a per-user row lock', async () => {
    address.findFirst.mockResolvedValue(null);
    address.create.mockImplementation(async ({ data }) => ({ id: 'a1', ...data }));
    const result = await service.createAddress('customer', { address: 'Home', latitude: 10, longitude: 106 });
    expect(result.isDefault).toBe(true);
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(address.findFirst.mock.invocationCallOrder[0]);
    expect(address.updateMany).toHaveBeenCalledWith({ where: { userId: 'customer', deletedAt: null }, data: { isDefault: false } });
  });

  it('rejects editing/removing another user address before any mutation', async () => {
    address.findFirst.mockResolvedValue(null);
    await expect(service.updateAddress('customer', 'foreign', { isDefault: true })).rejects.toThrow('khong ton tai');
    await expect(service.removeAddress('customer', 'foreign')).rejects.toThrow('khong ton tai');
    expect(address.findFirst).toHaveBeenCalledWith({ where: { id: 'foreign', userId: 'customer', deletedAt: null } });
    expect(address.update).not.toHaveBeenCalled();
    expect(address.updateMany).not.toHaveBeenCalled();
  });

  it('soft-deletes a default and promotes the oldest remaining live address', async () => {
    address.findFirst.mockResolvedValueOnce({ id: 'a1', isDefault: true }).mockResolvedValueOnce({ id: 'a2' });
    await service.removeAddress('customer', 'a1');
    expect(address.update).toHaveBeenNthCalledWith(1, { where: { id: 'a1' }, data: { deletedAt: expect.any(Date), isDefault: false } });
    expect(address.update).toHaveBeenNthCalledWith(2, { where: { id: 'a2' }, data: { isDefault: true } });
    expect(address.findFirst.mock.calls[1][0].where).toEqual({ userId: 'customer', deletedAt: null });
  });

  it('unsets previous defaults before selecting a new default', async () => {
    address.findFirst.mockResolvedValue({ id: 'a2', isDefault: false });
    await service.updateAddress('customer', 'a2', { isDefault: true });
    expect(address.updateMany.mock.invocationCallOrder[0]).toBeLessThan(address.update.mock.invocationCallOrder[0]);
    expect(address.updateMany.mock.calls[0][0].where).toEqual({ userId: 'customer', deletedAt: null });
  });

  it('keeps the only address default when explicitly unset, and lists only live addresses', async () => {
    address.findFirst.mockResolvedValueOnce({ id: 'a1', isDefault: true }).mockResolvedValueOnce(null);
    await service.updateAddress('customer', 'a1', { isDefault: false });
    expect(address.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { isDefault: true } });
    await service.addresses('customer');
    expect(address.findMany.mock.calls[0][0].where).toEqual({ userId: 'customer', deletedAt: null });
  });
});
