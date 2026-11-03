import { buildRevenueReport, CompletedBooking, periodRanges } from './revenue-report';

const booking = (at: string, total: number, extra: Partial<CompletedBooking> = {}): CompletedBooking => ({
  scheduledStart: new Date(at),
  totalAmount: total,
  addressSnapshot: { city: 'Hà Nội' },
  technicianId: 'tech-1',
  technician: { city: 'Hà Nội', district: 'Cầu Giấy', averageRating: 4.8, user: { displayName: 'Mai', avatarUrl: null } },
  items: [{ serviceName: 'Massage body', categoryName: 'Massage', durationMinutes: 60 }],
  ...extra,
});

describe('revenue report', () => {
  // 2026-11-03 10:00 in Vietnam, a Tuesday.
  const now = new Date('2026-11-03T10:00:00+07:00');

  it('uses Vietnam calendar boundaries for each period', () => {
    expect(periodRanges('day', now).current.start.toISOString()).toBe('2026-11-02T17:00:00.000Z');
    expect(periodRanges('week', now).current.start.toISOString()).toBe('2026-11-01T17:00:00.000Z'); // Monday 02/11
    expect(periodRanges('month', now).current.start.toISOString()).toBe('2025-12-31T17:00:00.000Z');
    expect(periodRanges('month', now).previous.end.toISOString()).toBe('2025-11-30T17:00:00.000Z');
  });

  it('computes month KPIs against last month', () => {
    const report = buildRevenueReport({
      period: 'month',
      now,
      totalRevenue: 2_000_000,
      completed: [
        booking('2026-11-01T09:00:00+07:00', 500_000),
        booking('2026-11-02T09:00:00+07:00', 300_000),
        booking('2026-10-31T23:30:00+07:00', 400_000),
      ],
      finishedThisMonth: { COMPLETED: 2, CANCELLED: 1, EXPIRED: 1 },
      finishedLastMonth: { COMPLETED: 1 },
    });
    expect(report.kpis).toEqual({
      totalRevenue: 2_000_000,
      revenueThisMonth: 800_000,
      revenueLastMonth: 400_000,
      averageOrderValue: 400_000,
      averageOrderValueLastMonth: 400_000,
      completedThisMonth: 2,
      completionRate: 50,
      completionRateLastMonth: 100,
    });
  });

  it('buckets the chart by month and compares with the same months last year', () => {
    const report = buildRevenueReport({
      period: 'month',
      now,
      totalRevenue: 0,
      completed: [
        booking('2026-01-15T09:00:00+07:00', 100),
        booking('2026-11-01T09:00:00+07:00', 300),
        booking('2025-01-20T09:00:00+07:00', 50),
        booking('2025-12-20T09:00:00+07:00', 999), // after "now" last year: not compared
      ],
      finishedThisMonth: {},
      finishedLastMonth: {},
    });
    expect(report.timeline).toHaveLength(11);
    expect(report.timeline[0]).toEqual({ label: 'Tháng 1', current: 100, previous: 50 });
    expect(report.timeline[10]).toEqual({ label: 'Tháng 11', current: 300, previous: 0 });
    expect(report.periodRevenue).toBe(400);
  });

  it('buckets today by Vietnam hour against yesterday', () => {
    const report = buildRevenueReport({
      period: 'day',
      now,
      totalRevenue: 0,
      completed: [booking('2026-11-03T08:30:00+07:00', 200), booking('2026-11-02T08:10:00+07:00', 150)],
      finishedThisMonth: {},
      finishedLastMonth: {},
    });
    expect(report.timeline).toHaveLength(24);
    expect(report.timeline[8]).toEqual({ label: '08:00', current: 200, previous: 150 });
  });

  it('ranks categories, regions, services and technicians within the period', () => {
    const report = buildRevenueReport({
      period: 'week',
      now,
      totalRevenue: 0,
      completed: [
        booking('2026-11-02T09:00:00+07:00', 600, {
          items: [
            { serviceName: 'Massage body', categoryName: 'Massage', durationMinutes: 60 },
            { serviceName: 'Gội đầu', categoryName: 'Spa', durationMinutes: 30 },
          ],
        }),
        booking('2026-11-03T09:00:00+07:00', 400, {
          addressSnapshot: { city: 'Đà Nẵng' },
          technicianId: 'tech-2',
          technician: { city: 'Đà Nẵng', district: null, averageRating: 5, user: { displayName: 'Lan', avatarUrl: 'a.png' } },
        }),
        booking('2026-10-20T09:00:00+07:00', 9_999), // outside both weeks
      ],
      finishedThisMonth: {},
      finishedLastMonth: {},
    });
    expect(report.byCategory).toEqual([
      { name: 'Massage', revenue: 700, bookings: 2, share: 70 },
      { name: 'Spa', revenue: 300, bookings: 1, share: 30 },
    ]);
    expect(report.byRegion.map((r) => [r.region, r.revenue])).toEqual([['Hà Nội', 600], ['Đà Nẵng', 400]]);
    expect(report.topServices[0]).toMatchObject({ name: 'Massage body', revenue: 700, bookings: 2 });
    expect(report.topTechnicians).toEqual([
      { name: 'Mai', avatarUrl: null, area: 'Hà Nội - Cầu Giấy', rating: 4.8, revenue: 600, completedOrders: 1 },
      { name: 'Lan', avatarUrl: 'a.png', area: 'Đà Nẵng', rating: 5, revenue: 400, completedOrders: 1 },
    ]);
  });
});
