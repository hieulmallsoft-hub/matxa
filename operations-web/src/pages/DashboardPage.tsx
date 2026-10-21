import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  UsersRound,
  Sparkles,
  Plus,
  ArrowRight,
  Clock,
  AlertTriangle,
  UserCheck,
  CreditCard,
  ChevronRight,
  Star,
  Check,
  TrendingUp,
  MapPin,
  Filter,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { request } from '../api/client';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { SectionCard } from '../components/common/SectionCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { NewReportModal } from '../components/dashboard/NewReportModal';

interface DashboardPageProps {
  onTriggerAction: (actionName: string) => void;
  onOpenReportModal: () => void;
  isReportModalOpen: boolean;
  onCloseReportModal: () => void;
}

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

const FALLBACK_BOOKINGS: BookingDisplayRow[] = [
  ['#1048', 'Nguyễn Thị Lan', 'Massage Trị Liệu Cổ Vai Gáy', 'Lê Thu Hương', '09:00', 'Confirmed', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80'],
  ['#1047', 'Trần Minh Hoàng', 'Massage Shiatsu Nhật Bản', 'Trần Văn Hoàng', '10:30', 'In Progress', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80'],
  ['#1046', 'Lê Thu Hà', 'Massage Đá Nóng Himalaya', 'Nguyễn Thị Mai', '13:00', 'Confirmed', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'],
  ['#1045', 'Phạm Tuấn Anh', 'Chăm Sóc Da Mặt Nâng Cơ', 'Vũ Thị Ngọc', '15:30', 'Pending', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80'],
  ['#1044', 'Vũ Quỳnh Trang', 'Combo Thư Giãn Toàn Diện', 'Lê Thu Hương', '17:00', 'Confirmed', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80'],
];

const REVENUE_SPARK_HOURLY = [
  { hour: '08h', revenue: 2400000 },
  { hour: '10h', revenue: 5800000 },
  { hour: '12h', revenue: 8200000 },
  { hour: '14h', revenue: 12500000 },
  { hour: '16h', revenue: 18900000 },
  { hour: '18h', revenue: 26400000 },
  { hour: '20h', revenue: 34200000 },
  { hour: '22h', revenue: 38600000 },
];

const ORDER_STATUS_DISTRIBUTION = [
  { name: 'Đã hoàn thành', value: 24, color: '#2E9B62' },
  { name: 'Đang thực hiện', value: 8, color: '#4285D4' },
  { name: 'Chờ xác nhận', value: 6, color: '#F2A93B' },
];

function useDashboardData() {
  const [stats, setStats] = useState<DashboardStats>({});
  const [liveBookings, setLiveBookings] = useState<BookingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    void Promise.all([
      request<DashboardStats>('/admin/marketplace/dashboard'),
      request<{ items: BookingRow[] }>('/admin/marketplace/bookings?limit=5'),
    ])
      .then(([nextStats, nextBookings]) => {
        if (nextStats) setStats(nextStats);
        if (nextBookings?.items?.length) setLiveBookings(nextBookings.items);
      })
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
  }, []);

  const displayBookings: BookingDisplayRow[] = liveBookings.length
    ? liveBookings.map((booking) => [
        booking.id.slice(0, 8),
        booking.customer?.displayName ?? 'Khách hàng',
        booking.items?.[0]?.serviceName ?? 'Dịch vụ Spa',
        booking.technician?.user?.displayName ?? 'Chưa phân công',
        booking.scheduledStart
          ? new Date(booking.scheduledStart).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
          : '--:--',
        booking.status ?? 'PENDING',
        'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80',
      ])
    : FALLBACK_BOOKINGS;

  return { stats, displayBookings, isLoading };
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onTriggerAction,
  onOpenReportModal,
  isReportModalOpen,
  onCloseReportModal,
}) => {
  const { stats, displayBookings } = useDashboardData();
  const [dateFilter, setDateFilter] = useState<'today' | '7d' | '30d' | 'month'>('today');

  const formattedRevenue = stats.revenueThisMonth
    ? new Intl.NumberFormat('vi-VN').format(stats.revenueThisMonth) + ' đ'
    : '248.560.000 đ';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6 pb-12"
    >
      {/* 1. Page Header with Time Filters */}
      <PageHeader
        title="Tổng quan hoạt động"
        subtitle="Theo dõi tình hình vận hành của MATXXA hôm nay"
        badge="Hoạt động bình thường"
        badgeTone="green"
        breadcrumbs={[
          { label: 'MATXXA' },
          { label: 'Tổng quan' },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center p-1 bg-[#F1F5EF] rounded-xl border border-[#E5EBE5]">
              {[
                { key: 'today', label: 'Hôm nay' },
                { key: '7d', label: '7 ngày' },
                { key: '30d', label: '30 ngày' },
                { key: 'month', label: 'Tháng này' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setDateFilter(tab.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    dateFilter === tab.key
                      ? 'bg-white text-[#2E7D4A] shadow-xs'
                      : 'text-[#66756B] hover:text-[#1C2B20]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={onOpenReportModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E5EBE5] hover:bg-[#F6F8F4] text-[#1C2B20] text-xs font-semibold transition-all cursor-pointer"
            >
              <span>Xuất báo cáo</span>
            </button>

            <button
              onClick={() => onTriggerAction('create-order')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white text-xs font-semibold shadow-sm shadow-[#2E7D4A]/25 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo đơn mới</span>
            </button>
          </div>
        }
      />

      {/* 2. KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Doanh thu hôm nay"
          value={dateFilter === 'today' ? '38.600.000 đ' : formattedRevenue}
          change={18.2}
          isPositive={true}
          caption="so với hôm qua"
          icon={<CircleDollarSign className="w-5 h-5" />}
          tone="primary"
          sparkline={[22, 26, 25, 29, 32, 35, 38]}
        />
        <StatCard
          label="Đơn đặt hôm nay"
          value={`${stats.todayBookings ?? 38} lịch`}
          change={26.5}
          isPositive={true}
          caption="vs tuần trước"
          icon={<CalendarDays className="w-5 h-5" />}
          tone="success"
          sparkline={[24, 28, 26, 31, 33, 36, 38]}
        />
        <StatCard
          label="KTV đang hoạt động"
          value={`${stats.activeTechnicians ?? 42} KTV`}
          change={8.5}
          isPositive={true}
          caption="trên tổng 50 KTV"
          icon={<UsersRound className="w-5 h-5" />}
          tone="info"
          sparkline={[34, 36, 38, 39, 40, 41, 42]}
        />
        <StatCard
          label="Đánh giá trung bình"
          value={`${(stats.averageRating ?? 4.94).toFixed(2)} / 5.0`}
          change={4.8}
          isPositive={true}
          caption={`${stats.reviewCount ?? 618} đánh giá`}
          icon={<Star className="w-5 h-5" />}
          tone="warning"
          sparkline={[4.88, 4.9, 4.91, 4.92, 4.93, 4.94]}
        />
      </div>

      {/* 3. Section "Việc cần xử lý" (Action Needed - Highly Prominent) */}
      <div className="p-5 rounded-2xl bg-[#FEF6E9]/60 border border-[#FBE3B8] shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#FBE3B8]/80 mb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#FEF6E9] text-[#B87A14] border border-[#FBE3B8]">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-bold text-[#1C2B20]">Việc cần xử lý ngay</h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF6E9] text-[#B87A14]">
              4 việc đang chờ
            </span>
          </div>
          <span className="text-xs text-[#66756B]">Cập nhật 2 phút trước</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div
            onClick={() => onTriggerAction('view-applications')}
            className="p-3.5 rounded-xl bg-white border border-[#E5EBE5] hover:border-[#D0DCD1] hover:shadow-xs transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#EAF5EC] text-[#2E7D4A] flex items-center justify-center flex-shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#1C2B20] block">Hồ sơ KTV chờ duyệt</span>
                <span className="text-[11px] text-[#66756B]">3 ứng viên mới nộp</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#94A399] group-hover:text-[#2E7D4A] transition-colors" />
          </div>

          <div
            onClick={() => onTriggerAction('view-bookings')}
            className="p-3.5 rounded-xl bg-white border border-[#E5EBE5] hover:border-[#D0DCD1] hover:shadow-xs transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#FEF6E9] text-[#B87A14] flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#1C2B20] block">Booking cần điều phối</span>
                <span className="text-[11px] text-[#66756B]">2 ca đặt lúc 16:00</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#94A399] group-hover:text-[#2E7D4A] transition-colors" />
          </div>

          <div
            onClick={() => onTriggerAction('view-payments')}
            className="p-3.5 rounded-xl bg-white border border-[#E5EBE5] hover:border-[#D0DCD1] hover:shadow-xs transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#EDF4FC] text-[#4285D4] flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#1C2B20] block">Xác minh thanh toán</span>
                <span className="text-[11px] text-[#66756B]">1 giao dịch QR chờ duyệt</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#94A399] group-hover:text-[#2E7D4A] transition-colors" />
          </div>

          <div
            onClick={() => onTriggerAction('view-complaints')}
            className="p-3.5 rounded-xl bg-white border border-[#E5EBE5] hover:border-[#D0DCD1] hover:shadow-xs transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#EBF8F1] text-[#2E9B62] flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#1C2B20] block">Phản hồi khách hàng</span>
                <span className="text-[11px] text-[#66756B]">0 khiếu nại tồn đọng</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#94A399] group-hover:text-[#2E7D4A] transition-colors" />
          </div>
        </div>
      </div>

      {/* 4. Main Charts Section (Doanh thu & Tình trạng đơn hàng) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Revenue Trend Area Chart */}
        <SectionCard
          title="Doanh thu hôm nay theo giờ"
          subtitle="Tốc độ tăng trưởng doanh thu so với ngày hôm qua"
          className="lg:col-span-2"
          action={
            <div className="flex items-center gap-1.5 text-xs text-[#2E7D4A] font-semibold bg-[#EAF5EC] px-2.5 py-1 rounded-lg">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+18.2% tăng trưởng</span>
            </div>
          }
        >
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={REVENUE_SPARK_HOURLY} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2E7D4A" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2E7D4A" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#EDF2EC" vertical={false} />
                <XAxis dataKey="hour" stroke="#94A399" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#94A399"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${(v / 1000000).toFixed(0)}Tr`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const val = payload[0]?.value as number;
                      return (
                        <div className="p-3 rounded-xl bg-white border border-[#E5EBE5] shadow-lg text-xs space-y-1">
                          <div className="font-bold text-[#1C2B20]">Khung giờ {label}</div>
                          <div className="text-[#2E7D4A] font-bold">
                            {new Intl.NumberFormat('vi-VN').format(val)} đ
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2E7D4A"
                  strokeWidth={2.5}
                  fill="url(#dashRevGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Right: Order Status Distribution */}
        <SectionCard
          title="Tình trạng đơn hàng"
          subtitle="38 lịch đặt trong ngày hôm nay"
          className="lg:col-span-1"
        >
          <div className="flex flex-col items-center">
            <div className="w-44 h-44 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ORDER_STATUS_DISTRIBUTION}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={72}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {ORDER_STATUS_DISTRIBUTION.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-[#1C2B20]">38</span>
                <span className="text-[11px] text-[#66756B]">Lịch hẹn</span>
              </div>
            </div>

            <div className="w-full space-y-2 mt-4 pt-3 border-t border-[#F1F5EF]">
              {ORDER_STATUS_DISTRIBUTION.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-[#1C2B20] font-medium">{item.name}</span>
                  </div>
                  <span className="font-bold text-[#1C2B20]">{item.value} ca</span>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* 5. Recent Bookings Table & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Bookings */}
        <SectionCard
          title="Lịch đặt dịch vụ gần nhất"
          subtitle="Các lịch hẹn massage và spa vừa được tiếp nhận"
          className="lg:col-span-2"
          noPadding
          action={
            <button
              onClick={() => onTriggerAction('view-bookings')}
              className="text-xs font-semibold text-[#2E7D4A] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Xem tất cả lịch hẹn</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6F8F4] text-[#66756B] uppercase font-semibold border-b border-[#E5EBE5]">
                <tr>
                  <th className="py-3 px-4">Mã</th>
                  <th className="py-3 px-4">Khách hàng</th>
                  <th className="py-3 px-4">Dịch vụ</th>
                  <th className="py-3 px-4">Kỹ thuật viên</th>
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-4">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5EF] text-sm text-[#1C2B20]">
                {displayBookings.map(([id, customer, service, therapist, time, status, avatar]) => (
                  <tr key={id} className="hover:bg-[#F6F8F4] transition-colors h-14">
                    <td className="py-3 px-4 font-mono font-semibold text-[#2E7D4A] text-xs">{id}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-[#E5EBE5]" />
                        <div>
                          <div className="font-bold text-xs">{customer}</div>
                          <div className="text-[11px] text-[#94A399]">+84 901 *** 888</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-xs truncate max-w-[160px]">{service}</div>
                      <div className="text-[10px] text-[#94A399]">60 - 90 phút</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-xs text-[#66756B]">{therapist}</td>
                    <td className="py-3 px-4 font-semibold text-xs">
                      <span>{time}</span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={status} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* Right 1 Col: Quick Actions */}
        <SectionCard
          title="Thao tác nhanh"
          subtitle="Tác vụ thường dùng cho ca trực"
          className="lg:col-span-1"
        >
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onTriggerAction('create-order')}
              className="p-3.5 rounded-xl bg-[#EAF5EC] hover:bg-[#DDF0E1] text-[#2E7D4A] text-left transition-all border border-[#D0E7D5] cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-2xs mb-2 group-hover:scale-105 transition-transform">
                <Plus className="w-4 h-4 text-[#2E7D4A]" />
              </div>
              <span className="font-bold text-xs block text-[#1C2B20]">Tạo đơn mới</span>
              <span className="text-[10px] text-[#66756B]">Đặt ca massage</span>
            </button>

            <button
              onClick={() => onTriggerAction('confirm-booking')}
              className="p-3.5 rounded-xl bg-[#EDF4FC] hover:bg-[#E1EDFA] text-[#4285D4] text-left transition-all border border-[#CDE0F8] cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-2xs mb-2 group-hover:scale-105 transition-transform">
                <CalendarDays className="w-4 h-4 text-[#4285D4]" />
              </div>
              <span className="font-bold text-xs block text-[#1C2B20]">Xác nhận lịch</span>
              <span className="text-[10px] text-[#66756B]">Duyệt booking</span>
            </button>

            <button
              onClick={() => onTriggerAction('add-service')}
              className="p-3.5 rounded-xl bg-[#FEF6E9] hover:bg-[#FDECD0] text-[#B87A14] text-left transition-all border border-[#FBE3B8] cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-2xs mb-2 group-hover:scale-105 transition-transform">
                <Sparkles className="w-4 h-4 text-[#B87A14]" />
              </div>
              <span className="font-bold text-xs block text-[#1C2B20]">Thêm dịch vụ</span>
              <span className="text-[10px] text-[#66756B]">Catalog gói spa</span>
            </button>

            <button
              onClick={() => onTriggerAction('add-customer')}
              className="p-3.5 rounded-xl bg-[#F6F8F4] hover:bg-[#EEF2EC] text-[#66756B] text-left transition-all border border-[#E5EBE5] cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-2xs mb-2 group-hover:scale-105 transition-transform">
                <UsersRound className="w-4 h-4 text-[#66756B]" />
              </div>
              <span className="font-bold text-xs block text-[#1C2B20]">Thêm khách</span>
              <span className="text-[10px] text-[#66756B]">Hồ sơ thành viên</span>
            </button>
          </div>

          <div className="mt-5 p-3.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Star className="w-5 h-5 fill-[#F2A93B] text-[#F2A93B]" />
              <div>
                <span className="text-xs font-bold text-[#1C2B20] block">Đánh giá khách hàng</span>
                <span className="text-[10px] text-[#66756B]">99.2% đánh giá 5 sao tuần này</span>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-[#2E7D4A]" />
          </div>
        </SectionCard>
      </div>

      <NewReportModal isOpen={isReportModalOpen} onClose={onCloseReportModal} />
    </motion.div>
  );
};

export default DashboardPage;
