import { AdminMarketplaceService } from './admin-marketplace.service';

// 2026-11-13 10:00 in Viet Nam (03:00 UTC).
const now = new Date('2026-11-13T03:00:00.000Z');
const at = (iso: string) => ({ cancelledByUserId: 'u1', cancelledAt: new Date(iso) });

it('counts the taken bookings a person cancelled today, in 7 days and this month (Viet Nam time), and the lock', async () => {
  const prisma: any = {
    systemSetting: { findMany: jest.fn().mockResolvedValue([]) }, // default rule: 3 in 24h -> 3h lock
    booking: {
      findMany: jest.fn().mockResolvedValue([
        at('2026-11-13T02:30:00.000Z'), // today 09:30
        at('2026-11-12T23:00:00.000Z'), // today 06:00
        at('2026-11-12T16:30:00.000Z'), // yesterday 23:30
        at('2026-11-02T01:00:00.000Z'), // this month, over a week ago
      ]),
    },
  };
  const stats = await (new AdminMarketplaceService(prisma) as any).cancelStats(['u1', 'u2'], now);
  expect(stats.get('u1')).toEqual({ today: 2, week: 3, month: 4, lockedUntil: new Date('2026-11-13T05:30:00.000Z') });
  expect(stats.get('u2')).toEqual({ today: 0, week: 0, month: 0, lockedUntil: null });
  expect(prisma.booking.findMany.mock.calls[0][0].where).toMatchObject({ cancelledByUserId: { in: ['u1', 'u2'] }, cancelPenalized: true });
});
