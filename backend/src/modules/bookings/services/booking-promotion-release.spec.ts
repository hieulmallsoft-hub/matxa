import { releaseBookingPromotion } from './booking-promotion-release';

// A booking cancelled (by customer, technician or admin) or expired without a technician gives the voucher back.
describe('releaseBookingPromotion', () => {
  const setup = (usage: unknown) => ({
    promotionUsage: { findUnique: jest.fn().mockResolvedValue(usage), delete: jest.fn() },
    promotion: { updateMany: jest.fn() },
  });

  it('gives the customer their voucher use back', async () => {
    const tx: any = setup({ id: 'usage-1', promotionId: 'promo-1' });
    await expect(releaseBookingPromotion(tx, 'booking-1')).resolves.toBe(true);
    expect(tx.promotionUsage.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { bookingId: 'booking-1' } }));
    expect(tx.promotionUsage.delete).toHaveBeenCalledWith({ where: { id: 'usage-1' } });
    expect(tx.promotion.updateMany).toHaveBeenCalledWith({
      where: { id: 'promo-1', usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  });

  it('does nothing for a booking without a voucher, or one already given back', async () => {
    const tx: any = setup(null);
    await expect(releaseBookingPromotion(tx, 'booking-1')).resolves.toBe(false);
    expect(tx.promotionUsage.delete).not.toHaveBeenCalled();
    expect(tx.promotion.updateMany).not.toHaveBeenCalled();
  });
});
