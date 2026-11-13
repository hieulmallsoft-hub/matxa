import { ConflictException } from '@nestjs/common';
import { applyCancelLimit, assertNotSuspended, cancelLimitStatus, isPenalizedCancel, nextSuspension, suspend } from './cancel-limit';

// Boss rule: 3 cancels of taken bookings in 24h suspend the person; repeats get longer (3h -> 24h -> 7 days),
// back to 3h after 30 days clean. Suspended people can still sign in but cannot book or take jobs.
const rules = { cancelLimitCount: 3, cancelLimitWindowHours: 24, suspensionHours: [3, 24, 168], suspensionResetDays: 30 };
const now = new Date('2026-11-13T10:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

/** In-memory bookings (counted cancels) and suspensions for one user. */
function fakeDb(cancels: Date[], suspensions: any[] = []) {
  return {
    booking: {
      count: jest.fn(async ({ where }: any) => cancels.filter((at) => at > where.cancelledAt.gt).length),
    },
    userSuspension: {
      findFirst: jest.fn(async ({ where, orderBy }: any) => {
        let rows = suspensions.filter((row) => !where.source || row.source === where.source);
        if (where.liftedAt === null) rows = rows.filter((row) => !row.liftedAt && row.endsAt > where.endsAt.gt);
        const key = orderBy.endsAt ? 'endsAt' : 'createdAt';
        return [...rows].sort((a, b) => b[key] - a[key])[0] ?? null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const row = { ...data, createdAt: data.startsAt, liftedAt: null };
        suspensions.push(row);
        return row;
      }),
    },
    suspensions,
  } as any;
}

describe('which cancels count', () => {
  const items = (count: number) => ({ bookingItem: { count: jest.fn().mockResolvedValue(count) } }) as any;
  it('counts a taken booking cancelled by its customer or technician in a counted category', async () => {
    await expect(isPenalizedCancel(items(1), 'b1', 'CONFIRMED', 'CUSTOMER', 'NO_LONGER_NEEDED')).resolves.toBe(true);
    await expect(isPenalizedCancel(items(1), 'b1', 'CONFIRMED', 'TECHNICIAN', 'OTHER')).resolves.toBe(true);
  });
  it('does not count a booking nobody took, an admin cancel, an evidence-backed reason or an excluded category', async () => {
    await expect(isPenalizedCancel(items(1), 'b1', 'OPEN', 'CUSTOMER')).resolves.toBe(false);
    await expect(isPenalizedCancel(items(1), 'b1', 'CONFIRMED', 'ADMIN')).resolves.toBe(false);
    await expect(isPenalizedCancel(items(1), 'b1', 'CONFIRMED', 'TECHNICIAN', 'CUSTOMER_NO_SHOW')).resolves.toBe(false);
    await expect(isPenalizedCancel(items(0), 'b1', 'CONFIRMED', 'CUSTOMER')).resolves.toBe(false);
  });
});

it('warns with one cancel left after two, and says the next suspension lasts 3 hours', async () => {
  const status = await cancelLimitStatus(fakeDb([hoursAgo(1), hoursAgo(5)]), 'u1', rules, now);
  expect(status).toMatchObject({ recentCancellations: 2, remainingBeforeLock: 1, lockedUntil: null, nextLockHours: 3, nextLevel: 1 });
});

it('the third cancel suspends for 3 hours; those cancels do not count again', async () => {
  const db = fakeDb([hoursAgo(0.5), hoursAgo(2), hoursAgo(5)]);
  const status = await applyCancelLimit(db, 'u1', rules, now);
  expect(db.suspensions).toHaveLength(1);
  expect(db.suspensions[0]).toMatchObject({ level: 1, source: 'CANCEL_LIMIT', endsAt: new Date('2026-11-13T13:00:00Z') });
  expect(status).toMatchObject({ lockedUntil: new Date('2026-11-13T13:00:00Z'), recentCancellations: 0, nextLockHours: 24 });
  await applyCancelLimit(db, 'u1', rules, now);
  expect(db.suspensions).toHaveLength(1);
});

it('repeats get longer: 3h, then 24h, then 7 days, and stay at 7 days asking for a review', async () => {
  const db = fakeDb([]);
  const lengths = [];
  for (let i = 0; i < 4; i++) {
    const at = new Date(now.getTime() + i * 10 * 86_400_000);
    const next = await nextSuspension(db, 'u1', rules, at);
    const row = await suspend(db, 'u1', rules, { reason: 'x', source: 'ADMIN' }, at);
    lengths.push([row.level, (row.endsAt.getTime() - at.getTime()) / 3_600_000, next.needsReview]);
  }
  expect(lengths).toEqual([[1, 3, false], [2, 24, false], [3, 168, false], [4, 168, true]]);
});

it('back to level 1 after 30 days without a suspension', async () => {
  const db = fakeDb([], [{ level: 2, source: 'ADMIN', createdAt: new Date(now.getTime() - 31 * 86_400_000), endsAt: hoursAgo(700), liftedAt: null }]);
  await expect(nextSuspension(db, 'u1', rules, now)).resolves.toEqual({ level: 1, hours: 3, needsReview: false });
});

it('is off when the admin sets the count to 0, but an admin suspension still applies', async () => {
  const db = fakeDb([hoursAgo(1), hoursAgo(1), hoursAgo(1)], [{ level: 1, source: 'ADMIN', reason: 'x', createdAt: hoursAgo(1), endsAt: new Date(now.getTime() + 3_600_000), liftedAt: null }]);
  const status = await applyCancelLimit(db, 'u1', { ...rules, cancelLimitCount: 0 }, now);
  expect(status).toMatchObject({ enabled: false, lockedUntil: new Date(now.getTime() + 3_600_000) });
  expect(db.suspensions).toHaveLength(1);
});

it('refuses with ACCOUNT_SUSPENDED, the end time and the reason while suspended; a lifted one does not count', async () => {
  const until = new Date(Date.now() + 3_600_000);
  const db = fakeDb([], [{ level: 2, reason: 'Huy 3 don', source: 'CANCEL_LIMIT', createdAt: new Date(), endsAt: until, liftedAt: null }]);
  const error = await assertNotSuspended(db, 'u1', true).catch((e) => e);
  expect(error).toBeInstanceOf(ConflictException);
  expect(error.getResponse()).toMatchObject({ code: 'ACCOUNT_SUSPENDED', lockedUntil: until, reason: 'Huy 3 don', level: 2 });
  db.suspensions[0].liftedAt = new Date();
  await expect(assertNotSuspended(db, 'u1')).resolves.toBeUndefined();
});
