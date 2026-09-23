import { BookingsService } from './bookings.service';
import { QuoteBookingDto } from '../dto/booking.dto';

describe('Quote and create share pricing/validation; address snapshots are immutable', () => {
  const db = {
    technicianService: { findMany: jest.fn() }, availabilitySlot: { findFirst: jest.fn() },
    booking: { findFirst: jest.fn(), create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    address: { findFirst: jest.fn() }, promotion: { findFirst: jest.fn(), update: jest.fn() },
    promotionUsage: { count: jest.fn() }, userIdentity: { findFirst: jest.fn() }, user: { findUnique: jest.fn() },
  };
  const prisma = { ...db, $transaction: jest.fn(async (fn: (client: typeof db) => unknown) => fn(db)) };
  const config = { get: jest.fn((_key: string, fallback: unknown) => fallback) };
  const notifications = { create: jest.fn(), sendPush: jest.fn() };
  const service = new BookingsService(prisma as never, config as never, notifications as never);
  const dto = (): QuoteBookingDto => ({ technicianId: 't1', serviceIds: ['s1'], mode: 'HOME',
    scheduledStart: new Date(Date.now() + 3600000).toISOString(), addressId: 'a1' });
  const originalAddress = { id: 'a1', address: 'Original street', label: 'Home', latitude: 10, longitude: 106 };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(async (fn) => fn(db));
    config.get.mockImplementation((_key, fallback) => fallback);
    db.technicianService.findMany.mockResolvedValue([{ id: 's1', name: 'Massage', durationMinutes: 60, price: 500000, modes: ['HOME', 'ONSITE', 'ONLINE'] }]);
    db.availabilitySlot.findFirst.mockResolvedValue({ id: 'window' });
    db.booking.findFirst.mockResolvedValue(null);
    db.address.findFirst.mockResolvedValue({ ...originalAddress });
    db.userIdentity.findFirst.mockResolvedValue({ id: 'phone' });
    db.user.findUnique.mockResolvedValue({ role: 'CUSTOMER' });
    db.promotionUsage.count.mockResolvedValue(0);
    db.booking.create.mockImplementation(async ({ data }) => ({ ...data, id: 'b1', technician: { userId: 'tech' }, address: { ...originalAddress }, status: 'PENDING' }));
  });

  it('quotes without reserving or mutating, using backend amounts and durations', async () => {
    const result = await service.quote('customer', { ...dto(), totalAmount: 1, price: 1 } as QuoteBookingDto);
    expect(result).toMatchObject({ subtotal: 500000, serviceFee: 100000, totalAmount: 600000, durationMinutes: 60,
      totalDuration: 60, serviceMode: 'HOME', services: [{ id: 's1', serviceId: 's1', technicianServiceId: 's1', price: 500000 }] });
    expect(+result.endAt - +result.startAt).toBe(3600000);
    expect(result.addressSnapshot).toMatchObject({ addressText: 'Original street', latitude: 10, longitude: 106 });
    expect(db.booking.create).not.toHaveBeenCalled();
    expect(db.promotion.update).not.toHaveBeenCalled();
    expect(db.promotionUsage.count).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates with the exact same quote logic inside the transaction and snapshots history', async () => {
    const input = dto();
    const expected = await service.quote('customer', input);
    const created = await service.create('customer', { ...input, paymentMethod: 'CASH' });
    const saved = db.booking.create.mock.calls[0][0].data;
    expect(saved).toMatchObject({ subtotal: expected.subtotal, totalAmount: expected.totalAmount, addressSnapshot: expected.addressSnapshot,
      items: { create: [{ serviceId: 's1', serviceName: 'Massage', durationMinutes: 60, unitPrice: 500000 }] } });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(created.address).toEqual(expected.addressSnapshot);
    // Simulate a later edit/deletion of the mutable Address relation.
    const stored = { ...created, customerId: 'customer', address: { ...originalAddress, address: 'New street', deletedAt: new Date() } };
    db.booking.findUnique.mockResolvedValue(stored);
    db.booking.findMany.mockResolvedValue([stored]);
    expect((await service.detail('customer', 'b1')).address).toMatchObject({ addressText: 'Original street' });
    expect((await service.listMine('customer'))[0].address).toMatchObject({ addressText: 'Original street' });
  });

  it.each(['ONSITE', 'ONLINE'] as const)('does not attach a customer address for %s', async (mode) => {
    const input = { ...dto(), mode };
    expect(await service.quote('customer', input)).toMatchObject({ serviceFee: 0, addressSnapshot: null });
    await service.create('customer', { ...input, paymentMethod: 'CASH' });
    expect(db.address.findFirst).not.toHaveBeenCalled();
    expect(db.booking.create.mock.calls[0][0].data.addressId).toBeNull();
  });

  it('rejects a missing, foreign or soft-deleted HOME address', async () => {
    await expect(service.quote('customer', { ...dto(), addressId: undefined })).rejects.toThrow('dia chi');
    db.address.findFirst.mockResolvedValue(null);
    await expect(service.quote('customer', dto())).rejects.toThrow('Dia chi khong hop le');
    expect(db.address.findFirst.mock.calls[0][0].where).toEqual({ id: 'a1', userId: 'customer', deletedAt: null });
  });

  it('rejects mismatched services/modes, past starts, unavailable windows and overlaps', async () => {
    db.technicianService.findMany.mockResolvedValueOnce([]);
    await expect(service.quote('customer', dto())).rejects.toThrow('khong hop le');
    db.technicianService.findMany.mockResolvedValueOnce([{ id: 's1', modes: ['ONLINE'], durationMinutes: 60 }]);
    await expect(service.quote('customer', dto())).rejects.toThrow('hinh thuc');
    await expect(service.quote('customer', { ...dto(), scheduledStart: new Date(0).toISOString() })).rejects.toThrow('tuong lai');
    db.availabilitySlot.findFirst.mockResolvedValueOnce(null);
    await expect(service.quote('customer', dto())).rejects.toThrow('khong ranh');
    db.booking.findFirst.mockResolvedValueOnce({ id: 'occupied' });
    await expect(service.create('customer', { ...dto(), paymentMethod: 'CASH' })).rejects.toThrow('da co nguoi dat');
    expect(db.booking.create).not.toHaveBeenCalled();
  });

  it('sums services once and avoids floating-point subtotal errors', async () => {
    db.technicianService.findMany.mockResolvedValue([{ id: 's2', price: 0.2, durationMinutes: 30, modes: ['ONSITE'] }, { id: 's1', price: 0.1, durationMinutes: 60, modes: ['ONSITE'] }]);
    const result = await service.quote('customer', { ...dto(), mode: 'ONSITE', serviceIds: ['s1', 's2', 's1'] });
    expect(result.subtotal).toBe(0.3);
    expect(result.durationMinutes).toBe(90);
    expect(result.services.map((item) => item.id)).toEqual(['s1', 's2']);
  });

  it('validates promotion, caps discount and never consumes it during quote', async () => {
    const promo = { id: 'promo', code: 'SALE', type: 'PERCENT', value: 50, minOrderAmount: 0, maxDiscount: 100000, perUserLimit: 1, usageLimit: 10, usedCount: 0 };
    db.promotion.findFirst.mockResolvedValue(promo);
    const result = await service.quote('customer', { ...dto(), promotionCode: ' sale ' });
    expect(result).toMatchObject({ discountAmount: 100000, totalAmount: 500000, promotionCode: 'SALE' });
    expect(db.promotion.update).not.toHaveBeenCalled();
    db.promotionUsage.count.mockResolvedValueOnce(1);
    await expect(service.quote('customer', { ...dto(), promotionCode: 'SALE' })).rejects.toThrow('het luot');
    db.promotion.findFirst.mockResolvedValueOnce(null);
    await expect(service.quote('customer', { ...dto(), promotionCode: 'EXPIRED' })).rejects.toThrow('het han');
    db.promotion.findFirst.mockResolvedValueOnce({ ...promo, minOrderAmount: 1000000 });
    await expect(service.quote('customer', { ...dto(), promotionCode: 'SALE' })).rejects.toThrow('toi thieu');
  });
});
