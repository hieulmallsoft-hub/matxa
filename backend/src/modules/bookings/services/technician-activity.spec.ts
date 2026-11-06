import { activityPeriods, technicianActivity } from './technician-activity';

describe('technician activity history', () => {
  // Thursday 6 Nov 2026, 08:30 in Viet Nam.
  const now = new Date('2026-11-06T01:30:00Z');

  it('cuts today, the week from Monday and the month in Viet Nam time', () => {
    const periods = activityPeriods(now);
    expect(periods.today.from.toISOString()).toBe('2026-11-05T17:00:00.000Z'); // 06/11 00:00 VN
    expect(periods.week.from.toISOString()).toBe('2026-11-01T17:00:00.000Z'); // Monday 02/11 00:00 VN
    expect(periods.month.from.toISOString()).toBe('2026-10-31T17:00:00.000Z'); // 01/11 00:00 VN
    expect(periods.month.to.toISOString()).toBe('2026-11-30T17:00:00.000Z'); // 01/12 00:00 VN
  });

  it('a Sunday still belongs to the week that started on Monday', () => {
    const sunday = activityPeriods(new Date('2026-11-08T16:00:00Z')); // Sunday 08/11 23:00 VN
    expect(sunday.week.from.toISOString()).toBe('2026-11-01T17:00:00.000Z');
  });

  it('counts completed bookings, distinct customers and earnings per period', async () => {
    const at = (iso: string) => new Date(iso);
    const done = [
      { id: 'b1', customerId: 'c1', scheduledStart: at('2026-11-06T02:00:00Z'), technicianEarning: '300000' }, // today
      { id: 'b2', customerId: 'c1', scheduledStart: at('2026-11-05T18:00:00Z'), technicianEarning: '200000' }, // today, same customer
      { id: 'b3', customerId: 'c2', scheduledStart: at('2026-11-03T03:00:00Z'), technicianEarning: '150000' }, // this week
      { id: 'b4', customerId: 'c3', scheduledStart: at('2026-11-01T03:00:00Z'), technicianEarning: null }, // Sunday: month only
    ];
    const prisma: any = { booking: { findMany: jest.fn().mockResolvedValueOnce(done).mockResolvedValueOnce([]) } };
    const result = await technicianActivity(prisma, 'tech-user-1', now);
    expect(result.today).toMatchObject({ completedBookings: 2, customers: 1, earning: 500000 });
    expect(result.week).toMatchObject({ completedBookings: 3, customers: 2, earning: 650000 });
    expect(result.month).toMatchObject({ completedBookings: 4, customers: 3, earning: 650000 });
    expect(prisma.booking.findMany.mock.calls[0][0].where).toMatchObject({ technician: { userId: 'tech-user-1' }, status: 'COMPLETED' });
  });
});
