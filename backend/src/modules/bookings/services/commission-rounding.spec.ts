import { BookingsService } from './bookings.service';
import { roundVnd } from './distance';

// Commission is real money: whole thousands of VND, and never eats the technician's travel fee.
describe('commission in real VND', () => {
  it('rounds to the nearest thousand dong', () => {
    expect(roundVnd(97_500)).toBe(98_000);
    expect(roundVnd(97_499)).toBe(97_000);
    expect(roundVnd(60)).toBe(0);
    expect(roundVnd(150_000)).toBe(150_000);
  });

  const charge = async (rate: number, booking: { grossServiceAmount: number; travelFee: number; serviceFee?: number }) => {
    const tx: any = {
      booking: { findFirst: jest.fn().mockResolvedValue(booking), update: jest.fn() },
      wallet: {
        upsert: jest.fn().mockResolvedValue({ id: 'w1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ balanceVnd: 1_000_000 }),
      },
      walletLedgerEntry: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    };
    tx.$transaction = jest.fn((callback: any) => callback(tx));
    const settings = { platformFeePercent: jest.fn().mockResolvedValue(rate), getBookingRules: jest.fn().mockResolvedValue({ dailyDiscountThreshold: 0 }) };
    const service = new BookingsService(
      tx, { get: (_k: string, d: unknown) => d } as any, {} as any, {} as any, undefined, undefined, undefined, settings as any,
    );
    await (service as any).chargeTechnicianCommission('tech', 'b1', tx);
    return tx;
  };

  it('charges 15% of 650.000đ as 98.000đ and keeps the travel fee for the technician', async () => {
    const tx = await charge(15, { grossServiceAmount: 650_000, travelFee: 50_000 });
    expect(tx.wallet.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { balanceVnd: { decrement: 98_000 } } }));
    expect(tx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ platformFee: 98_000, technicianEarning: 650_000 - 98_000 + 50_000 }) }),
    );
  });

  it('gives the technician the home surcharge in full, without commission on it', async () => {
    const tx = await charge(10, { grossServiceAmount: 550_000, serviceFee: 100_000, travelFee: 0 });
    expect(tx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ platformFee: 55_000, technicianEarning: 495_000 + 100_000 }) }),
    );
  });

  it('charges nothing for a commission below 500đ', async () => {
    const tx = await charge(0.01, { grossServiceAmount: 600_000, travelFee: 0 });
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
  });
});

// Vouchers are the platform's: the customer pays the technician less in cash, so the wallet is credited the discount.
describe('voucher paid by the platform', () => {
  it('credits the discount and charges the commission, so a credit larger than the fee needs no balance', async () => {
    const tx: any = {
      booking: { findFirst: jest.fn().mockResolvedValue({ grossServiceAmount: 500_000, serviceFee: 100_000, travelFee: 0, discountAmount: 250_000 }), update: jest.fn() },
      wallet: {
        upsert: jest.fn().mockResolvedValue({ id: 'w1', balanceVnd: 0 }),
        update: jest.fn().mockResolvedValue({ balanceVnd: 250_000 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ balanceVnd: 150_000 }),
      },
      walletLedgerEntry: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    };
    tx.$transaction = jest.fn((callback: any) => callback(tx));
    const settings = { platformFeePercent: jest.fn().mockResolvedValue(20), getBookingRules: jest.fn().mockResolvedValue({ dailyDiscountThreshold: 0 }) };
    const service = new BookingsService(tx, { get: (_k: string, d: unknown) => d } as any, {} as any, {} as any, undefined, undefined, undefined, settings as any);
    await (service as any).chargeTechnicianCommission('tech', 'b1', tx);
    const ledger = tx.walletLedgerEntry.create.mock.calls.map((call: any) => call[0].data);
    expect(ledger).toEqual([
      expect.objectContaining({ type: 'PROMOTION_CREDIT', amountVnd: 250_000, referenceType: 'BOOKING_PROMOTION_CREDIT' }),
      expect.objectContaining({ type: 'COMMISSION_DEBIT', amountVnd: -100_000, referenceType: 'BOOKING_COMMISSION' }),
    ]);
    // 350k cash from the customer + 150k net into the wallet = 500k, the same as without the voucher.
    expect(tx.booking.update.mock.calls[0][0].data).toMatchObject({ platformFee: 100_000, technicianEarning: 500_000 });
  });

  it('never settles the same booking twice', async () => {
    const tx: any = {
      booking: { findFirst: jest.fn().mockResolvedValue({ grossServiceAmount: 500_000, discountAmount: 250_000 }), update: jest.fn() },
      wallet: { upsert: jest.fn().mockResolvedValue({ id: 'w1' }), update: jest.fn(), updateMany: jest.fn() },
      walletLedgerEntry: { findFirst: jest.fn().mockResolvedValue({ id: 'credit' }), create: jest.fn() },
    };
    tx.$transaction = jest.fn((callback: any) => callback(tx));
    const settings = { platformFeePercent: jest.fn().mockResolvedValue(20), getBookingRules: jest.fn().mockResolvedValue({ dailyDiscountThreshold: 0 }) };
    const service = new BookingsService(tx, { get: (_k: string, d: unknown) => d } as any, {} as any, {} as any, undefined, undefined, undefined, settings as any);
    await (service as any).chargeTechnicianCommission('tech', 'b1', tx);
    expect(tx.wallet.update).not.toHaveBeenCalled();
    expect(tx.walletLedgerEntry.create).not.toHaveBeenCalled();
  });
});
