import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';

export type CancelLimitRules = { cancelLimitCount: number; cancelLimitWindowHours: number; cancelLockHours: number };
type Db = Pick<Prisma.TransactionClient, 'booking' | 'bookingItem'>;

/** Technician reasons that need photo evidence (customer no-show, unsafe, inappropriate request) are not their fault. */
export const EVIDENCE_REQUIRED_REASONS = new Set(['CUSTOMER_NO_SHOW', 'UNSAFE_SITUATION', 'INAPPROPRIATE_REQUEST']);

/**
 * Does this cancel count toward the canceller's limit? Only a booking a technician had already taken (CONFIRMED),
 * cancelled by its customer or technician (not an admin), for a category the admin counts, and not for a reason
 * backed by evidence. Cancelling a booking nobody took yet, or one that simply expired, never counts.
 */
export async function isPenalizedCancel(
  db: Db,
  bookingId: string,
  previousStatus: string,
  actorRole: string | null | undefined,
  reasonCode?: string | null,
) {
  if (previousStatus !== 'CONFIRMED' || !actorRole || !['CUSTOMER', 'TECHNICIAN'].includes(actorRole)) return false;
  if (actorRole === 'TECHNICIAN' && reasonCode && EVIDENCE_REQUIRED_REASONS.has(reasonCode)) return false;
  const counted = await db.bookingItem.count({
    where: { bookingId, OR: [{ categoryId: null }, { category: { countsCancellations: true } }] },
  });
  return counted > 0;
}

/**
 * The person's standing against the cancel limit: how many counted cancels in the window, how many are left
 * before a lock, and until when they are locked (null = not locked).
 */
export async function cancelLimitStatus(db: Pick<Prisma.TransactionClient, 'booking'>, userId: string, rules: CancelLimitRules, now = new Date()) {
  const limit = rules.cancelLimitCount;
  if (!limit) return { enabled: false, limit: 0, windowHours: rules.cancelLimitWindowHours, lockHours: rules.cancelLockHours, recentCancellations: 0, remainingBeforeLock: null, lockedUntil: null };
  const since = new Date(now.getTime() - rules.cancelLimitWindowHours * 3_600_000);
  const recent = await db.booking.findMany({
    where: { cancelledByUserId: userId, cancelPenalized: true, cancelledAt: { gte: since } },
    select: { cancelledAt: true },
    orderBy: { cancelledAt: 'desc' },
  });
  const unlockAt = recent.length >= limit ? new Date(recent[0].cancelledAt!.getTime() + rules.cancelLockHours * 3_600_000) : null;
  return {
    enabled: true,
    limit,
    windowHours: rules.cancelLimitWindowHours,
    lockHours: rules.cancelLockHours,
    recentCancellations: recent.length,
    remainingBeforeLock: Math.max(limit - recent.length, 0),
    lockedUntil: unlockAt && unlockAt > now ? unlockAt : null,
  };
}

/** 409 CANCEL_LIMIT_LOCKED while the person is locked out of new bookings / taking jobs. */
export async function assertNotCancelLocked(db: Pick<Prisma.TransactionClient, 'booking'>, userId: string, rules: CancelLimitRules, technician = false) {
  const status = await cancelLimitStatus(db, userId, rules);
  if (!status.lockedUntil) return;
  throw new ConflictException({
    statusCode: 409,
    code: 'CANCEL_LIMIT_LOCKED',
    message: technician
      ? 'Ban da huy qua nhieu don, tam thoi chua the nhan don moi'
      : 'Ban da huy qua nhieu don, tam thoi chua the dat don moi',
    lockedUntil: status.lockedUntil,
  });
}
