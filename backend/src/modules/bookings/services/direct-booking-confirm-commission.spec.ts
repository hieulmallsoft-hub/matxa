import { ConflictException } from '@nestjs/common';
import { BookingsService } from './bookings.service';

describe('technician confirms a direct booking', () => {
  const pending = {
    id: 'b1',
    status: 'PENDING',
    customerId: 'customer',
    technicianId: 't1',
    technician: { userId: 'tech' },
    scheduledEnd: new Date(Date.now() + 3_600_000),
    review: null,
  };

  const subject = () => {
    const tx: any = { booking: { update: jest.fn(async ({ data }: any) => ({ ...pending, ...data })) } };
    const prisma: any = {
      userIdentity: { findFirst: jest.fn().mockResolvedValue({ id: 'phone-1' }) },
      user: { findUnique: jest.fn().mockResolvedValue({ role: 'TECHNICIAN' }) },
      $transaction: jest.fn((callback: any) => callback(tx)),
    };
    const notifications = { getTemplate: jest.fn().mockResolvedValue(null), create: jest.fn(), sendPush: jest.fn() };
    const service = new BookingsService(prisma, { get: (_key: string, fallback: unknown) => fallback } as any, notifications as any, {} as any);
    jest.spyOn(service, 'detail').mockResolvedValue(pending as any);
    const expire = jest.spyOn(service, 'expireDirectBookingIfDue').mockResolvedValue(null as any);
    const charge = jest.spyOn(service as any, 'chargeTechnicianCommission').mockResolvedValue(undefined);
    return { service, prisma, tx, expire, charge };
  };

  it.each([
    ['accept', (s: BookingsService) => s.acceptTechnicianJob('tech', 'b1')],
    ['PATCH status', (s: BookingsService) => s.updateStatus('tech', 'b1', { status: 'CONFIRMED' })],
  ])('charges the commission in the same transaction as the confirmation (%s)', async (_name, confirm) => {
    const { service, tx, charge } = subject();
    await expect(confirm(service)).resolves.toMatchObject({ status: 'CONFIRMED' });
    expect(tx.booking.update).toHaveBeenCalledWith({ where: { id: 'b1', status: 'PENDING' }, data: { status: 'CONFIRMED' } });
    expect(charge).toHaveBeenCalledWith('tech', 'b1', tx);
  });

  it('charges nothing when the booking changed state before confirmation', async () => {
    const { service, tx, charge } = subject();
    tx.booking.update.mockRejectedValueOnce({ code: 'P2025' });
    await expect(service.acceptTechnicianJob('tech', 'b1')).rejects.toBeInstanceOf(ConflictException);
    expect(charge).not.toHaveBeenCalled();
  });

  it.each([
    ['accept', (s: BookingsService) => s.acceptTechnicianJob('tech', 'b1')],
    ['PATCH status', (s: BookingsService) => s.updateStatus('tech', 'b1', { status: 'CONFIRMED' })],
  ])('refuses an expired direct booking without charging (%s)', async (_name, confirm) => {
    const { service, tx, expire, charge } = subject();
    expire.mockResolvedValue({ id: 'b1' } as any);
    await expect(confirm(service)).rejects.toThrow('BOOKING_EXPIRED');
    expect(tx.booking.update).not.toHaveBeenCalled();
    expect(charge).not.toHaveBeenCalled();
  });

  it('does not charge when completing a booking', async () => {
    const { service, prisma, charge } = subject();
    (service.detail as jest.Mock).mockResolvedValue({ ...pending, status: 'CONFIRMED', scheduledEnd: new Date(Date.now() - 1000) });
    prisma.booking = { update: jest.fn().mockResolvedValue({ ...pending, status: 'COMPLETED' }) };
    await expect(service.updateStatus('tech', 'b1', { status: 'COMPLETED' })).resolves.toMatchObject({ status: 'COMPLETED' });
    expect(charge).not.toHaveBeenCalled();
  });
});
