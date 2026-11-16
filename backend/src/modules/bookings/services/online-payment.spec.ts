import { ConflictException } from '@nestjs/common';
import { createRefund, isAwaitingPayment, recordTechnicianEarning, vietQrUrl } from './online-payment';
import { BookingsService } from './bookings.service';
import { PayoutsService } from './payouts.service';
jest.mock('./cancel-limit', () => ({
  ...jest.requireActual('./cancel-limit'),
  activeSuspension: jest.fn().mockResolvedValue(null),
  applyCancelLimit: jest.fn().mockResolvedValue({ enabled: true, lockedUntil: null }),
}));

// Online (video/chat) bookings: pay after a technician takes them, within 15 minutes; the platform holds the money,
// pays the technician's share out by hand, and refunds a paid booking that is cancelled.
const online = (payment: object, extra: object = {}) => ({ status: 'CONFIRMED', mode: 'ONLINE', paymentDeadlineAt: new Date(), payment: { method: 'ONLINE', ...payment }, ...extra });

describe('which bookings wait for payment', () => {
  it('a taken online booking not paid yet', () => {
    expect(isAwaitingPayment(online({ status: 'UNPAID' }))).toBe(true);
    expect(isAwaitingPayment(online({ status: 'PENDING' }))).toBe(true);
  });
  it('not once paid, nor cash or home bookings, nor before a technician took it', () => {
    expect(isAwaitingPayment(online({ status: 'PAID' }))).toBe(false);
    expect(isAwaitingPayment(online({ status: 'UNPAID', method: 'CASH' }))).toBe(false);
    expect(isAwaitingPayment(online({ status: 'UNPAID' }, { mode: 'HOME' }))).toBe(false);
    expect(isAwaitingPayment(online({ status: 'UNPAID' }, { status: 'OPEN', paymentDeadlineAt: null }))).toBe(false);
  });
});

describe('technician earning on completion', () => {
  const db = (booking: object) => ({
    booking: { findUnique: jest.fn().mockResolvedValue(booking) },
    technicianEarning: { create: jest.fn(async ({ data }: any) => data) },
  }) as any;
  it('records price minus commission for a paid online booking', async () => {
    const tx = db({ mode: 'ONLINE', grossServiceAmount: 500000, subtotal: 500000, payment: { method: 'ONLINE', status: 'PAID' }, technician: { userId: 'tech-1' } });
    const earning = await recordTechnicianEarning(tx, 'b1', async (gross) => gross * 0.25);
    expect(earning).toEqual({ technicianUserId: 'tech-1', bookingId: 'b1', grossAmount: 500000, commission: 125000, amount: 375000 });
  });
  it('records nothing for a cash booking (the technician collected the money)', async () => {
    const tx = db({ mode: 'HOME', grossServiceAmount: 500000, payment: { method: 'CASH', status: 'UNPAID' }, technician: { userId: 'tech-1' } });
    await expect(recordTechnicianEarning(tx, 'b1', async () => 0)).resolves.toBeNull();
    expect(tx.technicianEarning.create).not.toHaveBeenCalled();
  });
});

describe('refund of a paid online booking', () => {
  const db = () => ({
    booking: { findUnique: jest.fn().mockResolvedValue({ customerId: 'c1', mode: 'ONLINE', payment: { method: 'ONLINE', status: 'PAID', amount: 500000 } }) },
    bookingRefund: { create: jest.fn(async ({ data }: any) => data) },
  }) as any;
  it('keeps the cancellation fee when the customer cancels after it was taken', async () => {
    await expect(createRefund(db(), 'b1', { reason: 'x', feePercent: 20 })).resolves.toMatchObject({ paidAmount: 500000, feeAmount: 100000, amount: 400000 });
  });
  it('refunds in full otherwise', async () => {
    await expect(createRefund(db(), 'b1', { reason: 'x', feePercent: 0 })).resolves.toMatchObject({ feeAmount: 0, amount: 500000 });
  });
});

it('builds a VietQR with account, amount and note, or nothing without an account', () => {
  expect(vietQrUrl('970436', '0123456789', 375000, 'PSYOCORE CHI ABC', 'NGUYEN VAN A')).toBe(
    'https://img.vietqr.io/image/970436-0123456789-compact2.png?amount=375000&addInfo=PSYOCORE+CHI+ABC&accountName=NGUYEN+VAN+A',
  );
  expect(vietQrUrl(null, '0123', 1, 'x')).toBeNull();
});

describe('BookingsService online payment flow', () => {
  const service = (prisma: any) => new BookingsService(prisma, { get: (_k: string, f: unknown) => f } as any, { create: jest.fn(), sendPush: jest.fn(), getTemplate: jest.fn() } as any, {} as any) as any;

  it('cannot pay before a technician takes the booking, nor after the window', async () => {
    const find = (booking: object) => ({ booking: { findUnique: jest.fn().mockResolvedValue({ mode: 'ONLINE', payment: { method: 'ONLINE', status: 'UNPAID' }, ...booking }) } });
    const open = await service(find({ status: 'OPEN', paymentDeadlineAt: null })).paymentWindow('b1').catch((e: any) => e);
    expect(open).toBeInstanceOf(ConflictException);
    expect(open.getResponse()).toMatchObject({ code: 'PAYMENT_NOT_OPEN' });
    const late = await service(find({ status: 'CONFIRMED', paymentDeadlineAt: new Date(Date.now() - 1000) })).paymentWindow('b1').catch((e: any) => e);
    expect(late.getResponse()).toMatchObject({ code: 'PAYMENT_NOT_OPEN' });
    const until = new Date(Date.now() + 600_000);
    await expect(service(find({ status: 'CONFIRMED', paymentDeadlineAt: until })).paymentWindow('b1')).resolves.toEqual(until);
  });

  it('cancels an unpaid booking after the window as the customer\'s counted cancel, freeing the technician', async () => {
    const tx = { booking: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, walletLedgerEntry: { findUnique: jest.fn().mockResolvedValue(null) }, promotionUsage: { findUnique: jest.fn().mockResolvedValue(null) } };
    const prisma: any = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({ id: 'b1', customerId: 'c1', status: 'CONFIRMED', paymentDeadlineAt: new Date(Date.now() - 1000), technician: { userId: 'tech-1' }, payment: { status: 'UNPAID' } }),
      },
      $transaction: jest.fn((run: any) => run(tx)),
    };
    const subject = service(prisma);
    jest.spyOn(subject, 'announceOpenJobsToFreedTechnician').mockResolvedValue(undefined);
    jest.spyOn(subject, 'notifyStatus').mockResolvedValue(undefined);
    const releasePromotion = jest.requireActual('./booking-promotion-release');
    jest.spyOn(releasePromotion, 'releaseBookingPromotion').mockResolvedValue(false);
    await expect(subject.cancelUnpaidBooking('b1')).resolves.toBe(true);
    expect(tx.booking.updateMany.mock.calls[0][0].data).toMatchObject({
      status: 'CANCELLED', cancellationReasonCode: 'PAYMENT_NOT_RECEIVED', cancelledByUserId: 'c1', cancelledByRole: 'CUSTOMER', cancelPenalized: true,
    });
    expect(subject.announceOpenJobsToFreedTechnician).toHaveBeenCalledWith('tech-1');
  });

  it('money that arrives after the booking was cancelled is queued for a full refund', async () => {
    const prisma: any = {
      booking: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ id: 'b1', status: 'CANCELLED', mode: 'ONLINE', customerId: 'c1', technician: null, payment: { method: 'ONLINE' } })
          .mockResolvedValueOnce({ customerId: 'c1', mode: 'ONLINE', payment: { method: 'ONLINE', status: 'PAID', amount: 500000 } }),
      },
      bookingRefund: { create: jest.fn(async ({ data }: any) => data) },
    };
    await service(prisma).afterPaymentPaid('b1');
    expect(prisma.bookingRefund.create.mock.calls[0][0].data).toMatchObject({ amount: 500000, feeAmount: 0 });
  });
});

describe('admin pays a technician out', () => {
  const setup = (earnings: Array<{ id: string; amount: number }>) => {
    const tx: any = {
      technicianEarning: { findMany: jest.fn().mockResolvedValue(earnings), updateMany: jest.fn().mockResolvedValue({ count: earnings.length }) },
      technicianProfile: { findUnique: jest.fn().mockResolvedValue({ bankBin: '970436', bankName: 'VCB', bankAccountNumber: '0123', bankAccountName: 'A' }) },
      technicianPayout: { create: jest.fn(async ({ data }: any) => ({ id: 'p1', ...data })) },
    };
    const prisma: any = { $transaction: jest.fn((run: any) => run(tx)) };
    return { tx, service: new PayoutsService(prisma) };
  };
  it('records the transfer and settles the earnings it covers', async () => {
    const { tx, service } = setup([{ id: 'e1', amount: 300000 }, { id: 'e2', amount: 75000 }]);
    await expect(service.markPaid('admin', 'tech-1', { upTo: '2026-11-16T03:00:00.000Z', amount: 375000 })).resolves.toMatchObject({ amount: 375000, accountNumber: '0123' });
    expect(tx.technicianEarning.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['e1', 'e2'] }, payoutId: null }, data: { payoutId: 'p1' } });
  });
  it('refuses when the amount no longer matches (new earnings or already paid)', async () => {
    const { service } = setup([{ id: 'e1', amount: 300000 }]);
    await expect(service.markPaid('admin', 'tech-1', { upTo: '2026-11-16T03:00:00.000Z', amount: 375000 })).rejects.toBeInstanceOf(ConflictException);
  });
});
