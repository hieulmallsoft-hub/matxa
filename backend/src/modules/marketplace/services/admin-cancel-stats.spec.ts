import { AdminMarketplaceService } from './admin-marketplace.service';

// 2026-11-13 10:00 in Viet Nam (03:00 UTC).
const now = new Date('2026-11-13T03:00:00.000Z');
const at = (iso: string) => ({ cancelledByUserId: 'u1', cancelledAt: new Date(iso) });

it('counts taken bookings cancelled today, in 7 days and this month (Viet Nam time), with the suspension and next level', async () => {
  const prisma: any = {
    systemSetting: { findMany: jest.fn().mockResolvedValue([]) }, // defaults: 3h, 24h, 7 days
    booking: {
      findMany: jest.fn().mockResolvedValue([
        at('2026-11-13T02:30:00.000Z'), // today 09:30
        at('2026-11-12T23:00:00.000Z'), // today 06:00
        at('2026-11-12T16:30:00.000Z'), // yesterday 23:30
        at('2026-11-02T01:00:00.000Z'), // this month, over a week ago
      ]),
    },
    userSuspension: {
      findMany: jest.fn().mockResolvedValue([
        { userId: 'u1', level: 1, reason: 'Huy 3 don', source: 'CANCEL_LIMIT', endsAt: new Date('2026-11-13T05:30:00.000Z'), liftedAt: null },
      ]),
    },
  };
  const stats = await (new AdminMarketplaceService(prisma) as any).cancelStats(['u1', 'u2'], now);
  expect(stats.get('u1')).toMatchObject({
    today: 2, week: 3, month: 4,
    lockedUntil: new Date('2026-11-13T05:30:00.000Z'),
    suspension: { level: 1, source: 'CANCEL_LIMIT' },
    nextLevel: 2, nextHours: 24, needsReview: false,
  });
  expect(stats.get('u2')).toMatchObject({ today: 0, week: 0, month: 0, lockedUntil: null, suspension: null, nextLevel: 1, nextHours: 3 });
});

it('admin suspends at the next level and can lift it early', async () => {
  const created: any[] = [];
  const prisma: any = {
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1' }) },
    systemSetting: { findMany: jest.fn().mockResolvedValue([]) },
    userSuspension: {
      findFirst: jest.fn(async ({ where }: any) => (where.liftedAt === null ? null : { level: 1, createdAt: new Date() })),
      create: jest.fn(async ({ data }: any) => (created.push(data), data)),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const notifications = { create: jest.fn(), sendPush: jest.fn() };
  const service = new AdminMarketplaceService(prisma, notifications as any);
  const suspension: any = await service.suspendUser('admin', 'u1', { reason: 'Huy don lien tuc' });
  expect(suspension).toMatchObject({ level: 2, source: 'ADMIN', createdById: 'admin', reason: 'Huy don lien tuc' });
  expect(suspension.endsAt.getTime() - suspension.startsAt.getTime()).toBe(24 * 3_600_000);
  expect(notifications.create.mock.calls[0][1]).toBe('ACCOUNT_SUSPENDED');
  await service.liftSuspension('u1');
  expect(prisma.userSuspension.updateMany.mock.calls[0][0].data).toEqual({ liftedAt: expect.any(Date) });
});
