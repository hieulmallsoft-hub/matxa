import { BookingsService } from './bookings.service';

// "Làm đủ 5 đơn trong ngày thì phí chiết khấu chỉ còn 20%": only bookings charged after the threshold get the lower rate.
describe('daily commission discount', () => {
  const charge = async (completedToday: number, rules: { dailyDiscountThreshold: number; dailyDiscountFeePercent: number }) => {
    const tx: any = {
      booking: {
        findFirst: jest.fn().mockResolvedValue({ grossServiceAmount: 500_000, travelFee: 0 }),
        count: jest.fn().mockResolvedValue(completedToday),
        update: jest.fn(),
      },
      wallet: {
        upsert: jest.fn().mockResolvedValue({ id: 'w1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ balanceVnd: 1_000_000 }),
      },
      walletLedgerEntry: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    };
    tx.$transaction = jest.fn((callback: any) => callback(tx));
    const settings = { platformFeePercent: jest.fn().mockResolvedValue(30), getBookingRules: jest.fn().mockResolvedValue(rules) };
    const service = new BookingsService(
      tx, { get: (_k: string, d: unknown) => d } as any, {} as any, {} as any, undefined, undefined, undefined, settings as any,
    );
    await (service as any).chargeTechnicianCommission('tech', 'b1', tx);
    return tx;
  };
  const charged = (tx: any) => tx.booking.update.mock.calls[0][0].data;

  it('charges 20% once the technician has completed 5 bookings today', async () => {
    const tx = await charge(5, { dailyDiscountThreshold: 5, dailyDiscountFeePercent: 20 });
    expect(charged(tx)).toMatchObject({ platformFee: 100_000, technicianEarning: 400_000, feePolicyVersion: 'COMMISSION_20_DAILY5_V1' });
    const where = tx.booking.count.mock.calls[0][0].where;
    expect(where).toMatchObject({ technician: { userId: 'tech' }, status: 'COMPLETED' });
    expect(where.scheduledStart.lt.getTime() - where.scheduledStart.gte.getTime()).toBe(86_400_000);
  });

  it('keeps the usual rate before the threshold', async () => {
    const tx = await charge(4, { dailyDiscountThreshold: 5, dailyDiscountFeePercent: 20 });
    expect(charged(tx)).toMatchObject({ platformFee: 150_000, feePolicyVersion: 'COMMISSION_30_V1' });
  });

  it('does nothing when the admin left it off', async () => {
    const tx = await charge(10, { dailyDiscountThreshold: 0, dailyDiscountFeePercent: 20 });
    expect(tx.booking.count).not.toHaveBeenCalled();
    expect(charged(tx)).toMatchObject({ platformFee: 150_000 });
  });

  it('never raises the fee when the "discount" is above the usual rate', async () => {
    const tx = await charge(10, { dailyDiscountThreshold: 5, dailyDiscountFeePercent: 40 });
    expect(charged(tx)).toMatchObject({ platformFee: 150_000 });
  });
});
