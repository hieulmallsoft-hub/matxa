import { PrismaService } from '../../../database/prisma.service';

const VN_OFFSET = 7 * 3_600_000;
const DAY = 86_400_000;

/** Start of today, this week (Monday) and this month in Viet Nam time, as UTC instants. */
export function activityPeriods(now: Date) {
  const local = new Date(now.getTime() + VN_OFFSET);
  const [year, month, date, weekday] = [local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), local.getUTCDay()];
  const today = Date.UTC(year, month, date) - VN_OFFSET;
  const week = today - ((weekday + 6) % 7) * DAY;
  const monthStart = Date.UTC(year, month, 1) - VN_OFFSET;
  return {
    today: { from: new Date(today), to: new Date(today + DAY) },
    week: { from: new Date(week), to: new Date(week + 7 * DAY) },
    month: { from: new Date(monthStart), to: new Date(Date.UTC(year, month + 1, 1) - VN_OFFSET) },
  };
}

type Done = { id: string; customerId: string; scheduledStart: Date; technicianEarning: unknown };

const summarise = (bookings: Done[], period: { from: Date; to: Date }) => {
  const inPeriod = bookings.filter((booking) => booking.scheduledStart >= period.from && booking.scheduledStart < period.to);
  return {
    from: period.from,
    to: period.to,
    completedBookings: inPeriod.length,
    customers: new Set(inPeriod.map((booking) => booking.customerId)).size,
    earning: inPeriod.reduce((sum, booking) => sum + Number(booking.technicianEarning ?? 0), 0),
  };
};

/**
 * What a technician has done today, this week and this month: completed bookings, distinct customers served and
 * what they earned (after commission, travel fee included), plus their latest completed bookings.
 */
export async function technicianActivity(prisma: PrismaService, userId: string, now = new Date()) {
  const periods = activityPeriods(now);
  const from = new Date(Math.min(+periods.week.from, +periods.month.from));
  const to = new Date(Math.max(+periods.week.to, +periods.month.to));
  const [done, recent] = await Promise.all([
    prisma.booking.findMany({
      where: { technician: { userId }, status: 'COMPLETED', scheduledStart: { gte: from, lt: to } },
      select: { id: true, customerId: true, scheduledStart: true, technicianEarning: true },
    }),
    prisma.booking.findMany({
      where: { technician: { userId }, status: 'COMPLETED' },
      orderBy: { scheduledStart: 'desc' },
      take: 20,
      select: {
        id: true,
        scheduledStart: true,
        scheduledEnd: true,
        mode: true,
        technicianEarning: true,
        customer: { select: { displayName: true, avatarUrl: true } },
        items: { select: { serviceName: true, durationMinutes: true } },
      },
    }),
  ]);
  return {
    timezone: 'Asia/Ho_Chi_Minh',
    today: summarise(done, periods.today),
    week: summarise(done, periods.week),
    month: summarise(done, periods.month),
    recent: recent.map((booking) => ({
      bookingId: booking.id,
      code: booking.id.slice(0, 8).toUpperCase(),
      scheduledStart: booking.scheduledStart,
      scheduledEnd: booking.scheduledEnd,
      mode: booking.mode,
      customer: { displayName: booking.customer.displayName, avatarUrl: booking.customer.avatarUrl },
      services: booking.items.map((item) => ({ name: item.serviceName, durationMinutes: item.durationMinutes })),
      earning: Number(booking.technicianEarning ?? 0),
    })),
  };
}
