import { ConflictException } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';

export type SuspensionRules = {
  cancelLimitCount: number;
  cancelLimitWindowHours: number;
  suspensionHours: number[];
  suspensionResetDays: number;
};
type Db = Pick<Prisma.TransactionClient, 'booking' | 'userSuspension'>;

/** Technician reasons that need photo evidence (customer no-show, unsafe, inappropriate request) are not their fault. */
export const EVIDENCE_REQUIRED_REASONS = new Set(['CUSTOMER_NO_SHOW', 'UNSAFE_SITUATION', 'INAPPROPRIATE_REQUEST']);

/**
 * Does this cancel count toward the canceller's limit? Only a booking a technician had already taken (CONFIRMED),
 * cancelled by its customer or technician (not an admin), for a category the admin counts, and not for a reason
 * backed by evidence. Cancelling a booking nobody took yet, or one that simply expired, never counts.
 */
export async function isPenalizedCancel(
  db: Pick<Prisma.TransactionClient, 'bookingItem'>,
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

/** The suspension in force (not lifted, not over), if any. */
export function activeSuspension(db: Pick<Prisma.TransactionClient, 'userSuspension'>, userId: string, now = new Date()) {
  return db.userSuspension.findFirst({
    where: { userId, liftedAt: null, endsAt: { gt: now } },
    orderBy: { endsAt: 'desc' },
  });
}

/**
 * The level and length the next suspension would have: one more than the last if that was within the reset period,
 * else level 1. Beyond the configured levels the last length repeats and `needsReview` asks the admin to look.
 */
export async function nextSuspension(db: Pick<Prisma.TransactionClient, 'userSuspension'>, userId: string, rules: SuspensionRules, now = new Date()) {
  const last = await db.userSuspension.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
  const fresh = !last || now.getTime() - last.createdAt.getTime() > rules.suspensionResetDays * 86_400_000;
  const level = fresh ? 1 : last!.level + 1;
  const levels = rules.suspensionHours.length ? rules.suspensionHours : [3, 24, 168];
  return { level, hours: levels[Math.min(level, levels.length) - 1], needsReview: level > levels.length };
}

/** Suspends the person at their next level (or for `hours` when the admin chose a length). */
export async function suspend(
  db: Pick<Prisma.TransactionClient, 'userSuspension'>,
  userId: string,
  rules: SuspensionRules,
  options: { reason: string; source: 'CANCEL_LIMIT' | 'ADMIN'; createdById?: string; hours?: number },
  now = new Date(),
) {
  const next = await nextSuspension(db, userId, rules, now);
  const hours = options.hours ?? next.hours;
  return db.userSuspension.create({
    data: {
      userId,
      level: next.level,
      reason: options.reason,
      source: options.source,
      createdById: options.createdById ?? null,
      startsAt: now,
      endsAt: new Date(now.getTime() + hours * 3_600_000),
    },
  });
}

const summary = (suspension: { level: number; reason: string; source: string; endsAt: Date } | null) =>
  suspension ? { level: suspension.level, reason: suspension.reason, source: suspension.source, endsAt: suspension.endsAt } : null;

/**
 * The person's standing: counted cancels in the window (since the last automatic suspension), how many are left before
 * the next one, the suspension in force (`lockedUntil`) and how long the next one would last.
 */
export async function cancelLimitStatus(db: Db, userId: string, rules: SuspensionRules, now = new Date()) {
  const [current, next] = await Promise.all([activeSuspension(db, userId, now), nextSuspension(db, userId, rules, now)]);
  const base = {
    windowHours: rules.cancelLimitWindowHours,
    lockedUntil: current?.endsAt ?? null,
    suspension: summary(current),
    nextLockHours: next.hours,
    nextLevel: next.level,
  };
  const limit = rules.cancelLimitCount;
  if (!limit) return { enabled: false, limit: 0, recentCancellations: 0, remainingBeforeLock: null, ...base };
  // Cancels already punished by an automatic suspension do not count again.
  const lastAuto = await db.userSuspension.findFirst({ where: { userId, source: 'CANCEL_LIMIT' }, orderBy: { createdAt: 'desc' } });
  const windowStart = now.getTime() - rules.cancelLimitWindowHours * 3_600_000;
  const since = new Date(Math.max(windowStart, lastAuto?.startsAt.getTime() ?? 0));
  const recent = await db.booking.count({ where: { cancelledByUserId: userId, cancelPenalized: true, cancelledAt: { gt: since } } });
  return { enabled: true, limit, recentCancellations: recent, remainingBeforeLock: Math.max(limit - recent, 0), ...base };
}

/** After a cancel: reaching the limit (and not already suspended) suspends the person at their next level. */
export async function applyCancelLimit(db: Db, userId: string, rules: SuspensionRules, now = new Date()) {
  const status = await cancelLimitStatus(db, userId, rules, now);
  if (!status.enabled || status.remainingBeforeLock !== 0 || status.lockedUntil) return status;
  await suspend(db, userId, rules, {
    reason: `Huy ${status.recentCancellations} don da co KTV nhan trong ${rules.cancelLimitWindowHours} gio`,
    source: 'CANCEL_LIMIT',
  }, now);
  return cancelLimitStatus(db, userId, rules, now);
}

/** 409 ACCOUNT_SUSPENDED while suspended: no new bookings (customer) or jobs (technician). */
export async function assertNotSuspended(db: Pick<Prisma.TransactionClient, 'userSuspension'>, userId: string, technician = false) {
  const current = await activeSuspension(db, userId);
  if (!current) return;
  throw new ConflictException({
    statusCode: 409,
    code: 'ACCOUNT_SUSPENDED',
    message: technician ? 'Tai khoan dang tam khoa, chua the nhan don moi' : 'Tai khoan dang tam khoa, chua the dat don moi',
    lockedUntil: current.endsAt,
    reason: current.reason,
    level: current.level,
  });
}
