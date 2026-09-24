import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

describe('BookingsService', () => {
  const technicianService = { findMany: jest.fn() };
  const availabilitySlot = { findFirst: jest.fn() };
  const booking = { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), create: jest.fn() };
  const technicianProfile = { findFirst: jest.fn(), update: jest.fn() };
  const review = { create: jest.fn(), aggregate: jest.fn() };
  const user = { findUnique: jest.fn() };
  const userIdentity = { findFirst: jest.fn() };
  const address = { findFirst: jest.fn() };
  const promotion = { findFirst: jest.fn() };
  const promotionUsage = { count: jest.fn() };
  const tx = { booking, technicianProfile, review, technicianService, availabilitySlot, address, promotion, promotionUsage };
  const prisma = { technicianService, availabilitySlot, booking, address, promotion, promotionUsage, user, userIdentity,
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) };
  const config = { get: jest.fn((_key: string, fallback: unknown) => fallback) };
  const notifications = { create: jest.fn(), sendPush: jest.fn() };
  const service = new BookingsService(prisma as never, config as never, notifications as never);

  beforeEach(() => { jest.clearAllMocks(); userIdentity.findFirst.mockResolvedValue({ id: 'phone' }); });
  afterEach(() => jest.restoreAllMocks());

  function existing(status = 'CONFIRMED') {
    return { id: 'b1', status, customerId: 'customer', technicianId: 't1', technician: { userId: 'tech' },
      scheduledEnd: new Date(Date.now() - 1000), review: null };
  }

  it('does not overwrite a cancellation when confirmation races with it', async () => {
    booking.findUnique.mockResolvedValue(existing('PENDING'));
    user.findUnique.mockResolvedValue({ role: 'TECHNICIAN' });
    booking.update.mockRejectedValueOnce({ code: 'P2025' });
    await expect(service.updateStatus('tech', 'b1', { status: 'CONFIRMED' })).rejects.toBeInstanceOf(ConflictException);
    expect(booking.update).toHaveBeenCalledWith({ where: { id: 'b1', status: 'PENDING' }, data: { status: 'CONFIRMED' } });
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('does not cancel a booking completed concurrently', async () => {
    booking.findUnique.mockResolvedValue(existing());
    user.findUnique.mockResolvedValue({ role: 'CUSTOMER' });
    booking.update.mockRejectedValueOnce({ code: 'P2025' });
    await expect(service.cancel('customer', 'b1', {})).rejects.toBeInstanceOf(ConflictException);
    expect(booking.update.mock.calls[0][0].where).toEqual({ id: 'b1', status: 'CONFIRMED' });
  });

  it('rejects completion before scheduled end and allows it afterwards', async () => {
    booking.findUnique.mockResolvedValue({ ...existing(), scheduledEnd: new Date(Date.now() + 60000) });
    user.findUnique.mockResolvedValue({ role: 'TECHNICIAN' });
    await expect(service.updateStatus('tech', 'b1', { status: 'COMPLETED' })).rejects.toBeInstanceOf(BadRequestException);
    expect(booking.update).not.toHaveBeenCalled();
    booking.findUnique.mockResolvedValue(existing());
    booking.update.mockResolvedValueOnce({ ...existing(), status: 'COMPLETED' });
    await expect(service.updateStatus('tech', 'b1', { status: 'COMPLETED' })).resolves.toHaveProperty('status', 'COMPLETED');
  });

  it('rejects customer status updates and unrelated cancellations', async () => {
    booking.findUnique.mockResolvedValue(existing());
    user.findUnique.mockResolvedValue({ role: 'CUSTOMER' });
    await expect(service.updateStatus('customer', 'b1', { status: 'COMPLETED' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.cancel('stranger', 'b1', {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(booking.update).not.toHaveBeenCalled();
  });

  it('rejects online payment before creating a booking', async () => {
    await expect(service.create('customer', { paymentMethod: 'ONLINE' } as never)).rejects.toThrow('online');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rechecks technician status inside the creation transaction', async () => {
    const quote = jest.spyOn(service, 'quote');
    technicianService.findMany.mockResolvedValueOnce([]);
    const dto = { technicianId: 't1', serviceIds: ['s1'], mode: 'HOME' as const, scheduledStart: new Date(Date.now() + 3600000).toISOString(), paymentMethod: 'CASH' as const };
    await expect(service.create('customer', dto)).rejects.toThrow('khong con hoat dong');
    expect(quote).toHaveBeenCalledWith('customer', dto, tx);
    expect(booking.create).not.toHaveBeenCalled();
  });

  it('requires a verified phone before quoting or writing a booking', async () => {
    userIdentity.findFirst.mockResolvedValueOnce(null);
    const quote = jest.spyOn(service, 'quote');
    await expect(service.create('customer', { paymentMethod: 'CASH' } as never)).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PHONE_VERIFICATION_REQUIRED' }),
    });
    expect(quote).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('retries the full review transaction on serialization conflict', async () => {
    booking.findFirst.mockResolvedValue(existing('COMPLETED'));
    review.create.mockRejectedValueOnce({ code: 'P2034' }).mockResolvedValue({ id: 'review' });
    review.aggregate.mockResolvedValue({ _avg: { rating: 4.5 }, _count: 2 });
    await expect(service.review('customer', 'b1', { rating: 5 })).resolves.toEqual({ id: 'review' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenLastCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(technicianProfile.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { averageRating: 4.5, reviewCount: 2 } });
  });

  it('maps duplicate reviews and exhausted serialization retries to client errors', async () => {
    booking.findFirst.mockResolvedValue(existing('COMPLETED'));
    review.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(service.review('customer', 'b1', { rating: 5 })).rejects.toBeInstanceOf(BadRequestException);
    review.create.mockRejectedValue({ code: 'P2034' });
    await expect(service.review('customer', 'b1', { rating: 5 })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).toHaveBeenCalledTimes(4);
  });

  it('rejects services that do not belong to the selected technician', async () => {
    technicianService.findMany.mockResolvedValue([]);
    await expect(service.quote('user-1', {
      technicianId: '00000000-0000-4000-8000-000000000001',
      serviceIds: ['00000000-0000-4000-8000-000000000002'],
      mode: 'ONSITE', scheduledStart: new Date(Date.now() + 3_600_000).toISOString(),
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('calculates home service fee and service duration on the server', async () => {
    technicianService.findMany.mockResolvedValue([{ id: 's1', name: 'Massage', durationMinutes: 60, price: 500000, modes: ['HOME'] }]);
    availabilitySlot.findFirst.mockResolvedValue({ id: 'slot-1' });
    booking.findFirst.mockResolvedValue(null);
    address.findFirst.mockResolvedValue({ id: 'address-1', address: 'Original address', latitude: 10, longitude: 106, label: 'Home' });
    const result = await service.quote('user-1', {
      technicianId: 't1', serviceIds: ['s1'], mode: 'HOME', addressId: 'address-1',
      scheduledStart: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(result).toEqual(expect.objectContaining({ subtotal: 500000, serviceFee: 100000, totalAmount: 600000, durationMinutes: 60 }));
    expect(technicianService.findMany).toHaveBeenCalledWith({ where: expect.objectContaining({ technician: { isActive: true, isVerified: true, user: { status: 'ACTIVE' }, serviceModes: { has: 'HOME' } } }) });
  });

  it('rejects a time range already booked', async () => {
    technicianService.findMany.mockResolvedValue([{ id: 's1', name: 'Massage', durationMinutes: 60, price: 500000, modes: ['ONSITE'] }]);
    availabilitySlot.findFirst.mockResolvedValue({ id: 'slot-1' });
    booking.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(service.quote('user-1', {
      technicianId: 't1', serviceIds: ['s1'], mode: 'ONSITE', scheduledStart: new Date(Date.now() + 3_600_000).toISOString(),
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
