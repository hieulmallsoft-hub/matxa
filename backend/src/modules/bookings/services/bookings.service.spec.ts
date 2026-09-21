import { BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

describe('BookingsService', () => {
  const technicianService = { findMany: jest.fn() };
  const availabilitySlot = { findFirst: jest.fn() };
  const booking = { findFirst: jest.fn() };
  const address = { findFirst: jest.fn() };
  const promotion = { findFirst: jest.fn() };
  const promotionUsage = { count: jest.fn() };
  const prisma = { technicianService, availabilitySlot, booking, address, promotion, promotionUsage };
  const config = { get: jest.fn((_key: string, fallback: unknown) => fallback) };
  const notifications = {};
  const service = new BookingsService(prisma as never, config as never, notifications as never);

  beforeEach(() => jest.clearAllMocks());

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
    address.findFirst.mockResolvedValue({ id: 'address-1' });
    const result = await service.quote('user-1', {
      technicianId: 't1', serviceIds: ['s1'], mode: 'HOME', addressId: 'address-1',
      scheduledStart: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(result).toEqual(expect.objectContaining({ subtotal: 500000, serviceFee: 100000, totalAmount: 600000, durationMinutes: 60 }));
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
