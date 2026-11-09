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

  const charge = async (rate: number, booking: { grossServiceAmount: number; travelFee: number }) => {
    const tx: any = {
      booking: { findFirst: jest.fn().mockResolvedValue(booking), update: jest.fn() },
      wallet: {
        upsert: jest.fn().mockResolvedValue({ id: 'w1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ balanceVnd: 1_000_000 }),
      },
      walletLedgerEntry: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn() },
    };
    tx.$transaction = jest.fn((callback: any) => callback(tx));
    const settings = { platformFeePercent: jest.fn().mockResolvedValue(rate) };
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

  it('charges nothing for a commission below 500đ', async () => {
    const tx = await charge(0.01, { grossServiceAmount: 600_000, travelFee: 0 });
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
  });
});
