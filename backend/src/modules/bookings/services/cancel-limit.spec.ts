import { ConflictException } from '@nestjs/common';
import { assertNotCancelLocked, cancelLimitStatus, isPenalizedCancel } from './cancel-limit';

// Boss rule: cancelling 3 taken bookings within 24h locks new bookings / jobs for 3h (admin-configurable).
describe('cancel limit', () => {
  const rules = { cancelLimitCount: 3, cancelLimitWindowHours: 24, cancelLockHours: 3 };
  const now = new Date('2026-11-12T10:00:00Z');
  const hoursAgo = (h: number) => ({ cancelledAt: new Date(now.getTime() - h * 3_600_000) });
  const db = (rows: Array<{ cancelledAt: Date }>) => ({ booking: { findMany: jest.fn().mockResolvedValue(rows) } }) as any;

  describe('which cancels count', () => {
    const items = (count: number) => ({ bookingItem: { count: jest.fn().mockResolvedValue(count) } }) as any;

    it('counts a taken booking cancelled by its customer or technician in a counted category', async () => {
      await expect(isPenalizedCancel(items(1), 'b1', 'CONFIRMED', 'CUSTOMER', 'NO_LONGER_NEEDED')).resolves.toBe(true);
      await expect(isPenalizedCancel(items(1), 'b1', 'CONFIRMED', 'TECHNICIAN', 'OTHER')).resolves.toBe(true);
    });

    it('does not count a booking nobody took, an admin cancel, an evidence-backed technician reason or an excluded category', async () => {
      await expect(isPenalizedCancel(items(1), 'b1', 'OPEN', 'CUSTOMER')).resolves.toBe(false);
      await expect(isPenalizedCancel(items(1), 'b1', 'PENDING', 'TECHNICIAN')).resolves.toBe(false);
      await expect(isPenalizedCancel(items(1), 'b1', 'CONFIRMED', 'ADMIN')).resolves.toBe(false);
      await expect(isPenalizedCancel(items(1), 'b1', 'CONFIRMED', 'TECHNICIAN', 'CUSTOMER_NO_SHOW')).resolves.toBe(false);
      await expect(isPenalizedCancel(items(0), 'b1', 'CONFIRMED', 'CUSTOMER')).resolves.toBe(false);
    });
  });

  it('warns with one cancel left after two', async () => {
    const status = await cancelLimitStatus(db([hoursAgo(1), hoursAgo(5)]), 'u1', rules, now);
    expect(status).toMatchObject({ recentCancellations: 2, remainingBeforeLock: 1, lockedUntil: null });
  });

  it('locks for 3 hours from the third cancel, then lets the person back', async () => {
    const locked = await cancelLimitStatus(db([hoursAgo(1), hoursAgo(2), hoursAgo(5)]), 'u1', rules, now);
    expect(locked.lockedUntil).toEqual(new Date('2026-11-12T12:00:00Z'));
    const after = await cancelLimitStatus(db([hoursAgo(4), hoursAgo(5), hoursAgo(6)]), 'u1', rules, now);
    expect(after.lockedUntil).toBeNull();
  });

  it('only looks at counted cancels by that person inside the window', async () => {
    const rows = db([]);
    await cancelLimitStatus(rows, 'u1', rules, now);
    expect(rows.booking.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { cancelledByUserId: 'u1', cancelPenalized: true, cancelledAt: { gte: new Date('2026-11-11T10:00:00Z') } },
    }));
  });

  it('is off when the admin sets the count to 0', async () => {
    const rows = db([hoursAgo(1), hoursAgo(1), hoursAgo(1)]);
    await expect(cancelLimitStatus(rows, 'u1', { ...rules, cancelLimitCount: 0 }, now)).resolves.toMatchObject({ enabled: false, lockedUntil: null });
    expect(rows.booking.findMany).not.toHaveBeenCalled();
  });

  it('refuses with CANCEL_LIMIT_LOCKED and the unlock time while locked', async () => {
    const recent = [0.1, 0.2, 0.3].map((h) => ({ cancelledAt: new Date(Date.now() - h * 3_600_000) }));
    const error = await assertNotCancelLocked(db(recent), 'u1', rules, true).catch((e) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toMatchObject({ code: 'CANCEL_LIMIT_LOCKED', lockedUntil: expect.any(Date) });
    await expect(assertNotCancelLocked(db(recent.slice(0, 2)), 'u1', rules)).resolves.toBeUndefined();
  });
});
