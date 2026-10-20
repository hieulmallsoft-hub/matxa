import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Plus,
  Sparkles,
  Star,
  UsersRound,
} from 'lucide-react';
import { request } from '../api/client';

interface DashboardPageProps {
  onTriggerAction: (actionName: string) => void;
  onOpenReportModal: () => void;
  isReportModalOpen: boolean;
  onCloseReportModal: () => void;
}

const FALLBACK_BOOKINGS = [
  ['#1048', 'Nguyá»…n Thá»‹ Lan', 'Aroma Massage', 'Mai Anh', '09:00', 'Confirmed', '/wellness/head-massage.jpg'],
  [
    '#1047',
    'Tráº§n Minh HoÃ ng',
    'Thai Massage',
    'Quang Huy',
    '10:30',
    'In Progress',
    '/wellness/massage-treatment.jpg',
  ],
  ['#1046', 'LÃª Thu HÃ ', 'Hot Stone Massage', 'Ngá»c TrÃ¢m', '13:00', 'Confirmed', '/wellness/spa-room.jpg'],
  ['#1045', 'Pháº¡m Tuáº¥n Anh', 'Facial Treatment', 'Tháº£o Vy', '15:30', 'Pending', '/wellness/consultation.jpg'],
  ['#1044', 'VÅ© Quá»³nh Trang', 'Body Scrub', 'Minh TÃ¢m', '17:00', 'Confirmed', '/wellness/massage-treatment.jpg'],
];
const STATUS_CLASS: Record<string, string> = {
  Confirmed: 'bg-[#e6f5df] text-[#2d8b40]',
  CONFIRMED: 'bg-[#e6f5df] text-[#2d8b40]',
  'In Progress': 'bg-[#e8f1ff] text-[#3b82d6]',
  IN_PROGRESS: 'bg-[#e8f1ff] text-[#3b82d6]',
  Pending: 'bg-[#fff1d8] text-[#bd7a16]',
  PENDING: 'bg-[#fff1d8] text-[#bd7a16]',
};

type BookingRow = {
  id: string;
  customer?: { displayName?: string | null };
  technician?: { user?: { displayName?: string | null } };
  items?: { serviceName?: string }[];
  scheduledStart?: string;
  status?: string;
};
type DashboardStats = {
  todayBookings?: number;
  activeTechnicians?: number;
  reviewCount?: number;
  averageRating?: number;
  revenueThisMonth?: number;
};

type BookingDisplayRow = [string, string, string, string, string, string, string];

function useDashboardData() {
  const [stats, setStats] = useState<DashboardStats>({});
  const [liveBookings, setLiveBookings] = useState<BookingRow[]>([]);

  useEffect(() => {
    void Promise.all([
      request<DashboardStats>('/admin/marketplace/dashboard'),
      request<{ items: BookingRow[] }>('/admin/marketplace/bookings?limit=5'),
    ])
      .then(([nextStats, nextBookings]) => {
        if (nextStats) setStats(nextStats);
        if (nextBookings?.items?.length) setLiveBookings(nextBookings.items);
      })
      .catch(() => undefined);
  }, []);

  const displayBookings: BookingDisplayRow[] = liveBookings.length
    ? liveBookings.map((booking) => [
        booking.id.slice(0, 8),
        booking.customer?.displayName ?? 'Khách hàng',
        booking.items?.[0]?.serviceName ?? 'Dịch vụ',
        booking.technician?.user?.displayName ?? 'Chưa phân công',
        booking.scheduledStart
          ? new Date(booking.scheduledStart).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          : '--:--',
        booking.status ?? 'PENDING',
        '/wellness/massage-treatment.jpg',
      ])
    : (FALLBACK_BOOKINGS as BookingDisplayRow[]);

  return { stats, displayBookings };
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onTriggerAction }) => {
  const { stats, displayBookings } = useDashboardData();
  const revenue = stats.revenueThisMonth
    ? new Intl.NumberFormat('vi-VN').format(stats.revenueThisMonth)
    : '128,560,000';
  return (
    <div className="mx-auto max-w-[1500px] space-y-5 pb-10 text-[#1f2b22]">
      <section className="relative min-h-[185px] overflow-hidden rounded-[22px] bg-[#eaf5e2] shadow-[0_8px_25px_rgba(49,106,45,.08)]">
        <img
          src="/wellness/massage-treatment.jpg"
          alt="Matxxa wellness"
          className="absolute inset-0 h-full w-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#eaf5e2] via-[#eaf5e2]/90 to-transparent" />
        <div className="relative max-w-[650px] px-7 py-7 sm:px-9 sm:py-8">
          <p className="mb-2 text-sm font-semibold text-[#3f8140]">Good morning,</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#14251a] sm:text-[38px]">
            Welcome back to Matxxa! <span className="text-[#4d9a48]">ðŸŒ¿</span>
          </h1>
          <p className="mt-2 text-sm text-[#638069]">Let's create more moments of relaxation today.</p>
        </div>
      </section>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={<CalendarDays />}
          label="Total Bookings"
          value={stats.todayBookings ? `${stats.todayBookings}` : '1,248'}
          trend="+12%"
          caption="vs last month"
        />
        <Metric
          icon={<Check />}
          label="Today's Appointments"
          value={`${stats.todayBookings ?? 28}`}
          trend="+27%"
          caption="vs yesterday"
        />
        <Metric
          icon={<UsersRound />}
          label="Active Customers"
          value={stats.activeTechnicians ? `${stats.activeTechnicians}` : '892'}
          trend="+8%"
          caption="vs last month"
        />
        <Metric
          icon={<CircleDollarSign />}
          label="Revenue (VND)"
          value={revenue}
          trend="+18%"
          caption="vs last month"
        />
      </section>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
        <section className="rounded-[20px] border border-[#e2ebe0] bg-white p-5 shadow-[0_7px_22px_rgba(49,106,45,.06)]">
          <PanelTitle
            icon={<CalendarDays />}
            title="Recent Bookings"
            action="View all"
            onAction={() => onTriggerAction('view-bookings')}
          />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[#edf1eb] text-xs text-[#647469]">
                <tr>
                  <th className="pb-4">#</th>
                  <th className="pb-4">Customer</th>
                  <th className="pb-4">Service</th>
                  <th className="pb-4">Therapist</th>
                  <th className="pb-4">Date &amp; Time</th>
                  <th className="pb-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {displayBookings.map(([id, customer, service, therapist, time, status, avatar]) => (
                  <tr key={id} className="border-b border-[#f0f3ef] last:border-0">
                    <td className="py-4 font-semibold text-[#708072]">{id}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-2.5">
                        <img src={avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                        <div>
                          <b className="block text-[#26352a]">{customer}</b>
                          <span className="text-xs text-[#7d8c80]">+84 901 665 444</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <b className="block">{service}</b>
                      <span className="text-xs text-[#7d8c80]">60 minutes</span>
                    </td>
                    <td className="py-3">{therapist}</td>
                    <td className="py-3">
                      <b className="block">Today, {time}</b>
                      <span className="text-xs text-[#7d8c80]">Apr 26, 2026</span>
                    </td>
                    <td className="py-3">
                      <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${STATUS_CLASS[status]}`}>
                        {status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="rounded-[20px] border border-[#e2ebe0] bg-white p-5 shadow-[0_7px_22px_rgba(49,106,45,.06)]">
          <PanelTitle
            icon={<CalendarDays />}
            title="Schedule"
            action="View schedule"
            onAction={() => onTriggerAction('view-schedule')}
          />
          <div className="mt-4 flex items-center justify-between">
            <button className="rounded-lg p-1 text-[#819087] hover:bg-[#f2f7ef]">
              <ChevronLeft size={17} />
            </button>
            <b>April 2026</b>
            <button className="rounded-lg p-1 text-[#819087] hover:bg-[#f2f7ef]">
              <ChevronRight size={17} />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-[#718078]">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <span key={day} className="py-1 font-semibold">
                {day}
              </span>
            ))}
            {Array.from({ length: 35 }, (_, index) => {
              const day = index - 2;
              return (
                <span
                  key={index}
                  className={`rounded-full py-1.5 ${day === 26 ? 'bg-[#2f8a40] text-white' : day > 0 && day <= 30 ? 'text-[#425246]' : 'text-[#cbd4cc]'}`}
                >
                  {day > 0 && day <= 30 ? day : ''}
                </span>
              );
            })}
          </div>
          <div className="mt-4 space-y-3 border-t border-[#edf1eb] pt-4">
            <p className="text-sm font-bold">Today's Appointments (Apr 26)</p>
            {displayBookings.slice(0, 4).map((booking) => (
              <div key={booking[0]} className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-[#45a255]" />
                <span className="w-10 font-semibold text-[#718078]">{booking[4]}</span>
                <span className="flex-1 truncate">{booking[2]}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[booking[5]]}`}>{booking[5]}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(310px,1fr)]">
        <section className="rounded-[20px] border border-[#e2ebe0] bg-white p-5 shadow-[0_7px_22px_rgba(49,106,45,.06)]">
          <PanelTitle
            icon={<Sparkles />}
            title="Bookings Trend"
            action="Last 30 days"
            onAction={() => onTriggerAction('bookings-trend')}
          />
          <div className="mt-5 flex h-48 items-end gap-3 rounded-xl bg-gradient-to-t from-[#f3f9ef] to-white px-4 pb-5 pt-3">
            {[35, 44, 39, 58, 50, 66, 62, 78, 72, 91, 82, 96].map((height, index) => (
              <div key={index} className="flex flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-t-md bg-[#b8dfb3]" style={{ height: `${height}%` }} />
                <span className="text-[9px] text-[#91a094]">Apr {index + 1 + (index > 7 ? 10 : 0)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-3">
            <TrendStat label="Total Bookings" value="1,248" />
            <TrendStat label="Growth Rate" value="+12%" />
            <TrendStat label="Avg. Rating" value="4.8/5" />
          </div>
        </section>
        <section className="rounded-[20px] border border-[#e2ebe0] bg-white p-5 shadow-[0_7px_22px_rgba(49,106,45,.06)]">
          <PanelTitle icon={<Plus />} title="Quick Actions" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <QuickAction
              icon={<Plus />}
              title="Add Service"
              subtitle="Create new spa service"
              onClick={() => onTriggerAction('add-service')}
              tone="green"
            />
            <QuickAction
              icon={<CalendarDays />}
              title="Confirm Booking"
              subtitle="Manage appointments"
              onClick={() => onTriggerAction('confirm-booking')}
              tone="blue"
            />
            <QuickAction
              icon={<Sparkles />}
              title="Create Promotion"
              subtitle="Launch special offer"
              onClick={() => onTriggerAction('create-promotion')}
              tone="pink"
            />
            <QuickAction
              icon={<UsersRound />}
              title="Add Customer"
              subtitle="Register new customer"
              onClick={() => onTriggerAction('add-customer')}
              tone="blue"
            />
          </div>
          <div className="mt-5 rounded-xl bg-[#f0f8eb] p-4">
            <div className="flex items-center gap-3">
              <Star className="fill-[#e9af26] text-[#e9af26]" size={22} />
              <div>
                <b className="block text-sm">Customer Reviews</b>
                <span className="text-[11px] text-[#718078]">Keep your team inspired.</span>
              </div>
              <ArrowRight className="ml-auto text-[#4b9853]" size={17} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

function Metric({
  icon,
  label,
  value,
  trend,
  caption,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend: string;
  caption: string;
}) {
  return (
    <div className="rounded-[18px] border border-[#e2ebe0] bg-white p-5 shadow-[0_7px_22px_rgba(49,106,45,.06)]">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e4f5df] text-[#319047]">
          {icon}
        </span>
        <span className="text-sm font-semibold text-[#5e6d62]">{label}</span>
      </div>
      <div className="mt-4 text-3xl font-extrabold tracking-tight">{value}</div>
      <div className="mt-2 text-xs">
        <b className="text-[#29913e]">â†‘ {trend}</b>
        <span className="ml-1 text-[#96a198]">{caption}</span>
      </div>
    </div>
  );
}
function PanelTitle({
  icon,
  title,
  action,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <span className="text-[#34934a]">{icon}</span>
        {title}
      </h2>
      {action && (
        <button
          onClick={onAction}
          className="flex items-center gap-1 text-sm font-semibold text-[#5c8860] hover:text-[#2e7b3b]"
        >
          {action}
          <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}
function TrendStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-xl bg-[#f4f8f1] p-3">
      <span className="block text-[10px] text-[#87958a]">{label}</span>
      <b className="mt-1 block text-base">{value}</b>
    </div>
  );
}
function QuickAction({
  icon,
  title,
  subtitle,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  tone: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${tone === 'green' ? 'bg-[#edf8e9]' : tone === 'pink' ? 'bg-[#fff0f0]' : 'bg-[#eef7fc]'}`}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 text-[#318846]">{icon}</span>
      <b className="mt-3 block text-xs">{title}</b>
      <span className="mt-1 block text-[10px] text-[#829087]">{subtitle}</span>
    </button>
  );
}

export default DashboardPage;
