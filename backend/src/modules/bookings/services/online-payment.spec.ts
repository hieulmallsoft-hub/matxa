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
  it('uses the commission fixed when the job was taken (what the job showed), not today\'s rate', async () => {
    const tx = db({ mode: 'ONLINE', grossServiceAmount: 502000, platformFee: 5000, payment: { method: 'ONLINE', status: 'PAID' }, technician: { userId: 'tech-1' } });
    const today = jest.fn(async () => 99999);
    await expect(recordTechnicianEarning(tx, 'b1', today)).resolves.toMatchObject({ commission: 5000, amount: 497000 });
    expect(today).not.toHaveBeenCalled();
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
      payment: { findFirst: jest.fn().mockResolvedValue({ id: 'pay-1', bookingId: 'b1', status: 'UNPAID', provider: null, providerRef: null }) },
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

  const assign = (amount: number) => {
    const tx: any = {
      booking: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'b1', mode: 'ONLINE', travelFee: 0, payment: { method: 'ONLINE' } }),
        update: jest.fn(async ({ data }: any) => ({ id: 'b1', mode: 'ONLINE', paymentDeadlineAt: data.paymentDeadlineAt, payment: { method: 'ONLINE', status: 'UNPAID', amount } })),
      },
      bookingTechnicianApplication: {
        findFirst: jest.fn().mockResolvedValue({ id: 'a1', technicianProfileId: 'p1', technicianProfile: { user: { id: 'tech-1' } } }),
        update: jest.fn(), updateMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const subject = service({ $transaction: jest.fn((run: any) => run(tx)) });
    jest.spyOn(subject, 'assertOpenEligibility').mockResolvedValue(undefined);
    jest.spyOn(subject, 'bookingRules').mockResolvedValue({ onlinePaymentWaitMinutes: 15 });
    const charge = jest.spyOn(subject, 'chargeTechnicianCommission').mockResolvedValue(undefined);
    const fixCommission = jest.spyOn(subject, 'recordPrepaidCommission').mockResolvedValue(undefined);
    return { tx, run: () => subject.assignOpenBooking('b1', 'a1', 'c1'), charge, fixCommission };
  };

  it('a technician taking an online booking gives the customer a payment deadline and fixes the commission, wallet untouched', async () => {
    const { tx, run, charge, fixCommission } = assign(500000);
    await run();
    expect(tx.booking.update).toHaveBeenCalledTimes(1);
    expect(tx.booking.update.mock.calls[0][0].data.paymentDeadlineAt).toBeInstanceOf(Date);
    expect(charge).not.toHaveBeenCalled();
    expect(fixCommission).toHaveBeenCalledWith('tech-1', 'b1', tx);
  });

  it('the job of a prepaid online booking shows price minus commission, with no voucher credit', () => {
    const pricing = service({}).technicianPricing({ mode: 'ONLINE', payment: { method: 'ONLINE' }, grossServiceAmount: 502000, platformFee: 5000, technicianEarning: 497000, discountAmount: 500000, totalAmount: 2000 });
    expect(pricing).toMatchObject({ platformFee: 5000, discountAmount: 0, technicianEarning: 497000, customerPaysAmount: 2000 });
    // a cash booking keeps the voucher credit to the wallet
    const cash = service({}).technicianPricing({ mode: 'HOME', payment: { method: 'CASH' }, grossServiceAmount: 502000, platformFee: 125500, technicianEarning: 376500, discountAmount: 500000 });
    expect(cash.discountAmount).toBe(500000);
  });

  it('a booking a voucher brought down to 0đ is paid as soon as it is taken (no payment link to open)', async () => {
    const { tx, run } = assign(0);
    await run();
    expect(tx.booking.update.mock.calls[1][0].data).toMatchObject({
      paymentDeadlineAt: null,
      payment: { update: { status: 'PAID', provider: 'VOUCHER' } },
    });
  });

  it('a 0đ booking that is cancelled queues no refund', async () => {
    const tx: any = {
      booking: { findUnique: jest.fn().mockResolvedValue({ customerId: 'c1', mode: 'ONLINE', payment: { method: 'ONLINE', status: 'PAID', amount: 0 } }) },
      bookingRefund: { create: jest.fn() },
    };
    await expect(createRefund(tx, 'b1', { reason: 'x', feePercent: 20 })).resolves.toBeNull();
    expect(tx.bookingRefund.create).not.toHaveBeenCalled();
  });

  describe('PayOS webhook lost: ask PayOS', () => {
    const pending = { id: 'pay-1', bookingId: 'b1', status: 'PENDING', provider: 'PAYOS', providerRef: '123', amount: 2000 };
    const setup = (info: object | null) => {
      const prisma: any = {
        payment: { findFirst: jest.fn().mockResolvedValue(pending), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        booking: { findUnique: jest.fn().mockResolvedValue({ id: 'b1', status: 'CONFIRMED', paymentDeadlineAt: new Date(Date.now() - 1000), payment: { status: 'PENDING' } }) },
        $transaction: jest.fn(),
      };
      const payos = { isConfigured: () => true, getPaymentInfo: jest.fn().mockResolvedValue({ code: info ? '00' : '01', desc: null, data: info }) };
      const subject = new BookingsService(prisma, { get: (_k: string, f: unknown) => f } as any, { create: jest.fn() } as any, {} as any, undefined, payos as any) as any;
      const paid = jest.spyOn(subject, 'afterPaymentPaid').mockResolvedValue(undefined);
      return { prisma, subject, paid };
    };

    it('records a payment PayOS says is paid, with the payer\'s account', async () => {
      const { prisma, subject, paid } = setup({ status: 'PAID', amount: 2000, amountPaid: 2000, transactions: [{ reference: 'FT1', counterAccountNumber: '0123', counterAccountName: 'NGUYEN VAN A' }] });
      await expect(subject.syncPayosPayment('b1')).resolves.toBe('PAID');
      expect(prisma.payment.updateMany.mock.calls[0][0]).toMatchObject({
        where: { id: 'pay-1', status: { in: ['PENDING', 'UNPAID'] } },
        data: { status: 'PAID', providerTransactionNo: 'FT1', payerAccountNumber: '0123', payerAccountName: 'NGUYEN VAN A' },
      });
      expect(paid).toHaveBeenCalledWith('b1');
    });

    it('changes nothing while PayOS has no payment yet', async () => {
      const { prisma, subject } = setup({ status: 'PENDING', amount: 2000, amountPaid: 0 });
      await expect(subject.syncPayosPayment('b1')).resolves.toBe('PENDING');
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
    });

    it('does not cancel for non-payment a booking that was in fact paid', async () => {
      const { prisma, subject } = setup({ status: 'PAID', amount: 2000, amountPaid: 2000, transactions: [] });
      await expect(subject.cancelUnpaidBooking('b1')).resolves.toBe(false);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  it('a webhook for an order that is not a booking payment is acknowledged, not rejected', async () => {
    const payos = { verifyWebhook: (body: any) => body.data };
    const prisma: any = { payment: { findFirst: jest.fn().mockResolvedValue(null) } };
    const subject = new BookingsService(prisma, {} as any, {} as any, {} as any, undefined, payos as any);
    await expect(subject.processPayosWebhook({ code: '00', success: true, data: { orderCode: 99, amount: 1000 } })).resolves.toMatchObject({ code: '00', handled: false });
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
