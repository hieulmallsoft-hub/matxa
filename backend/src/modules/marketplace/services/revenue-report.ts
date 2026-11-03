/** Admin revenue report: completed bookings (by scheduledStart, Asia/Ho_Chi_Minh) aggregated in memory. */

export type RevenuePeriod = 'day' | 'week' | 'month';

export type CompletedBooking = {
  scheduledStart: Date;
  totalAmount: unknown;
  addressSnapshot: unknown;
  technicianId: string | null;
  technician: {
    city: string | null;
    district: string | null;
    averageRating: unknown;
    user: { displayName: string | null; avatarUrl: string | null };
  } | null;
  items: { serviceName: string; categoryName: string | null; durationMinutes: number }[];
};

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC instant of local midnight (VN) for the given local calendar date. */
const vnDate = (year: number, month: number, day = 1) => new Date(Date.UTC(year, month, day) - VN_OFFSET_MS);
const vnParts = (date: Date) => {
  const local = new Date(date.getTime() + VN_OFFSET_MS);
  return { year: local.getUTCFullYear(), month: local.getUTCMonth(), day: local.getUTCDate(), hour: local.getUTCHours(), weekday: (local.getUTCDay() + 6) % 7 };
};

export type Range = { start: Date; end: Date };

export function monthRanges(now: Date) {
  const { year, month } = vnParts(now);
  return {
    current: { start: vnDate(year, month), end: vnDate(year, month + 1) },
    previous: { start: vnDate(year, month - 1), end: vnDate(year, month) },
  };
}

/**
 * Chart window for a period plus the window it is compared with:
 * day = today by hour vs yesterday, week = this week (Mon–Sun) vs last week,
 * month = this year's months up to now vs the same months last year.
 */
export function periodRanges(period: RevenuePeriod, now: Date) {
  const { year, month, day, weekday } = vnParts(now);
  if (period === 'day') {
    const start = vnDate(year, month, day);
    return { current: { start, end: new Date(start.getTime() + DAY_MS) }, previous: { start: new Date(start.getTime() - DAY_MS), end: start } };
  }
  if (period === 'week') {
    const start = vnDate(year, month, day - weekday);
    return { current: { start, end: new Date(start.getTime() + 7 * DAY_MS) }, previous: { start: new Date(start.getTime() - 7 * DAY_MS), end: start } };
  }
  return {
    current: { start: vnDate(year, 0), end: vnDate(year, month + 1) },
    previous: { start: vnDate(year - 1, 0), end: vnDate(year - 1, month + 1) },
  };
}

const WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

function bucketLabels(period: RevenuePeriod, now: Date) {
  if (period === 'day') return Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
  if (period === 'week') return WEEKDAYS;
  return Array.from({ length: vnParts(now).month + 1 }, (_, m) => `Tháng ${m + 1}`);
}

function bucketIndex(period: RevenuePeriod, date: Date) {
  const parts = vnParts(date);
  return period === 'day' ? parts.hour : period === 'week' ? parts.weekday : parts.month;
}

const amount = (value: unknown) => Number(value ?? 0);
const inRange = (date: Date, range: Range) => date >= range.start && date < range.end;
const sum = (bookings: CompletedBooking[]) => bookings.reduce((total, booking) => total + amount(booking.totalAmount), 0);

function rank<T extends { revenue: number }>(map: Map<string, T>, limit?: number) {
  const rows = [...map.values()].sort((a, b) => b.revenue - a.revenue);
  return limit ? rows.slice(0, limit) : rows;
}

export function buildRevenueReport(input: {
  period: RevenuePeriod;
  now: Date;
  totalRevenue: number;
  completed: CompletedBooking[];
  /** Bookings scheduled this month / last month that reached a final state, by status. */
  finishedThisMonth: Record<string, number>;
  finishedLastMonth: Record<string, number>;
}) {
  const { period, now, completed } = input;
  const months = monthRanges(now);
  const ranges = periodRanges(period, now);

  const thisMonth = completed.filter((b) => inRange(b.scheduledStart, months.current));
  const lastMonth = completed.filter((b) => inRange(b.scheduledStart, months.previous));
  const completionRate = (counts: Record<string, number>) => {
    const done = counts.COMPLETED ?? 0;
    const total = done + (counts.CANCELLED ?? 0) + (counts.EXPIRED ?? 0);
    return total ? Math.round((done / total) * 1000) / 10 : 0;
  };
  const average = (bookings: CompletedBooking[]) => (bookings.length ? Math.round(sum(bookings) / bookings.length) : 0);

  const labels = bucketLabels(period, now);
  const timeline = labels.map((label) => ({ label, current: 0, previous: 0 }));
  const current: CompletedBooking[] = [];
  for (const booking of completed) {
    const isCurrent = inRange(booking.scheduledStart, ranges.current);
    if (!isCurrent && !inRange(booking.scheduledStart, ranges.previous)) continue;
    const bucket = timeline[bucketIndex(period, booking.scheduledStart)];
    if (!bucket) continue;
    if (isCurrent) {
      bucket.current += amount(booking.totalAmount);
      current.push(booking);
    } else {
      bucket.previous += amount(booking.totalAmount);
    }
  }

  const categories = new Map<string, { name: string; revenue: number; bookings: number }>();
  const regions = new Map<string, { region: string; revenue: number; bookings: number }>();
  const services = new Map<string, { name: string; duration: number; revenue: number; bookings: number }>();
  const technicians = new Map<string, { name: string; avatarUrl: string | null; area: string; rating: number; revenue: number; completedOrders: number }>();
  for (const booking of current) {
    const revenue = amount(booking.totalAmount);
    // A multi-item booking's total is split evenly so category/service sums still add up to revenue.
    const share = booking.items.length ? revenue / booking.items.length : 0;
    for (const item of booking.items) {
      const category = item.categoryName || 'Chưa phân loại';
      const c = categories.get(category) ?? { name: category, revenue: 0, bookings: 0 };
      c.revenue += share;
      c.bookings += 1;
      categories.set(category, c);
      const s = services.get(item.serviceName) ?? { name: item.serviceName, duration: item.durationMinutes, revenue: 0, bookings: 0 };
      s.revenue += share;
      s.bookings += 1;
      services.set(item.serviceName, s);
    }
    const city = (booking.addressSnapshot as { city?: string } | null)?.city || booking.technician?.city || 'Chưa rõ khu vực';
    const r = regions.get(city) ?? { region: city, revenue: 0, bookings: 0 };
    r.revenue += revenue;
    r.bookings += 1;
    regions.set(city, r);
    if (booking.technicianId && booking.technician) {
      const t = technicians.get(booking.technicianId) ?? {
        name: booking.technician.user.displayName || 'KTV',
        avatarUrl: booking.technician.user.avatarUrl,
        area: [booking.technician.city, booking.technician.district].filter(Boolean).join(' - '),
        rating: amount(booking.technician.averageRating),
        revenue: 0,
        completedOrders: 0,
      };
      t.revenue += revenue;
      t.completedOrders += 1;
      technicians.set(booking.technicianId, t);
    }
  }
  const currentRevenue = sum(current);
  const withShare = <T extends { revenue: number }>(rows: T[]) =>
    rows.map((row) => ({ ...row, revenue: Math.round(row.revenue), share: currentRevenue ? Math.round((row.revenue / currentRevenue) * 1000) / 10 : 0 }));

  return {
    period,
    kpis: {
      totalRevenue: input.totalRevenue,
      revenueThisMonth: sum(thisMonth),
      revenueLastMonth: sum(lastMonth),
      averageOrderValue: average(thisMonth),
      averageOrderValueLastMonth: average(lastMonth),
      completedThisMonth: thisMonth.length,
      completionRate: completionRate(input.finishedThisMonth),
      completionRateLastMonth: completionRate(input.finishedLastMonth),
    },
    timeline,
    periodRevenue: currentRevenue,
    byCategory: withShare(rank(categories)),
    byRegion: withShare(rank(regions)),
    topServices: withShare(rank(services, 5)),
    topTechnicians: rank(technicians, 5).map((t) => ({ ...t, revenue: Math.round(t.revenue) })),
  };
}
