import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart as LineChartIcon,
  TrendingUp,
  Download,
  Calendar,
  Sparkles,
  UsersRound,
  Award,
  MapPin,
  CircleDollarSign,
  Receipt,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { SectionCard } from '../components/common/SectionCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { useToast } from '../components/ui/ToastContainer';

// Vietnamese currency formatter
const formatVND = (val: number) => `${new Intl.NumberFormat('vi-VN').format(val)} đ`;

// Trend data over time with comparison to previous period
const REVENUE_TIMELINE = {
  day: [
    { label: '08:00', current: 2400000, previous: 1800000 },
    { label: '10:00', current: 5800000, previous: 4200000 },
    { label: '12:00', current: 8200000, previous: 7100000 },
    { label: '14:00', current: 12500000, previous: 10400000 },
    { label: '16:00', current: 18900000, previous: 15200000 },
    { label: '18:00', current: 26400000, previous: 22100000 },
    { label: '20:00', current: 34200000, previous: 28500000 },
    { label: '22:00', current: 38600000, previous: 31800000 },
  ],
  week: [
    { label: 'Thứ 2', current: 28500000, previous: 24100000 },
    { label: 'Thứ 3', current: 32400000, previous: 27800000 },
    { label: 'Thứ 4', current: 31200000, previous: 29500000 },
    { label: 'Thứ 5', current: 36800000, previous: 32000000 },
    { label: 'Thứ 6', current: 45200000, previous: 38400000 },
    { label: 'Thứ 7', current: 52600000, previous: 44200000 },
    { label: 'Chủ nhật', current: 48900000, previous: 41000000 },
  ],
  month: [
    { label: 'Tháng 1', current: 165000000, previous: 142000000 },
    { label: 'Tháng 2', current: 182000000, previous: 155000000 },
    { label: 'Tháng 3', current: 194000000, previous: 168000000 },
    { label: 'Tháng 4', current: 208000000, previous: 179000000 },
    { label: 'Tháng 5', current: 221000000, previous: 188000000 },
    { label: 'Tháng 6', current: 234000000, previous: 198000000 },
    { label: 'Tháng 7', current: 228000000, previous: 202000000 },
    { label: 'Tháng 8', current: 236000000, previous: 210000000 },
    { label: 'Tháng 9', current: 242000000, previous: 218000000 },
    { label: 'Tháng 10', current: 248560000, previous: 224000000 },
  ],
};

const REVENUE_STRUCTURE = [
  { name: 'Massage tại nhà', value: 58, revenue: 144164800, color: '#2E7D4A' },
  { name: 'Spa & Trị liệu Studio', value: 24, revenue: 59654400, color: '#41955F' },
  { name: 'Gói Combo VIP', value: 12, revenue: 29827200, color: '#AEE4BB' },
  { name: 'Dịch vụ khác & Mẹ bé', value: 6, revenue: 14913600, color: '#F2A93B' },
];

const TOP_SERVICES = [
  {
    name: 'Massage Trị Liệu Cổ Vai Gáy Chuyên Sâu',
    duration: '60 - 90 phút',
    bookings: 642,
    revenue: 417300000,
    growth: '+26.4%',
  },
  {
    name: 'Massage Đá Nóng Himalaya Phục Hồi',
    duration: '90 phút',
    bookings: 480,
    revenue: 360000000,
    growth: '+18.2%',
  },
  {
    name: 'Combo Thư Giãn Toàn Diện 120 Phút',
    duration: '120 phút',
    bookings: 310,
    revenue: 387500000,
    growth: '+32.5%',
  },
  {
    name: 'Massage Shiatsu Nhật Bản & Bấm Huyệt',
    duration: '60 phút',
    bookings: 285,
    revenue: 156750000,
    growth: '+12.8%',
  },
];

const TOP_TECHNICIANS = [
  {
    name: 'Lê Thu Hương',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80',
    area: 'TP. Hồ Chí Minh - Quận 1',
    completedOrders: 142,
    revenue: 92300000,
    rating: 4.98,
  },
  {
    name: 'Nguyễn Thị Mai',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    area: 'TP. Hồ Chí Minh - Quận 3',
    completedOrders: 128,
    revenue: 83200000,
    rating: 4.95,
  },
  {
    name: 'Vũ Thị Ngọc',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
    area: 'Hà Nội - Cầu Giấy',
    completedOrders: 115,
    revenue: 74750000,
    rating: 4.92,
  },
  {
    name: 'Trần Văn Hoàng',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    area: 'Đà Nẵng - Hải Châu',
    completedOrders: 98,
    revenue: 63700000,
    rating: 4.91,
  },
];

const REGIONAL_REVENUE = [
  { region: 'TP. Hồ Chí Minh (Quận 1, 3, Bình Thạnh)', revenue: 142800000, share: 57.5 },
  { region: 'Hà Nội (Cầu Giấy, Hoàn Kiếm, Ba Đình)', revenue: 76200000, share: 30.6 },
  { region: 'Đà Nẵng (Hải Châu, Sơn Trà)', revenue: 29560000, share: 11.9 },
];

export const AnalyticsPage: React.FC = () => {
  const { addToast } = useToast();
  const [timeTab, setTimeTab] = useState<'day' | 'week' | 'month'>('month');
  const [showComparison, setShowComparison] = useState(true);

  const handleExportReport = () => {
    addToast({
      title: 'Xuất báo cáo thành công',
      message: 'Báo cáo doanh thu định dạng Excel (.xlsx) đã được tải xuống.',
      type: 'success',
    });
  };

  const chartData = REVENUE_TIMELINE[timeTab];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6 pb-12"
    >
      {/* 1. Header */}
      <PageHeader
        title="Doanh thu & Báo cáo"
        subtitle="Theo dõi hiệu quả kinh doanh, xu hướng tăng trưởng và đóng góp của kỹ thuật viên"
        badge="Dữ liệu thời gian thực"
        badgeTone="green"
        breadcrumbs={[
          { label: 'MATXXA' },
          { label: 'Doanh thu & Báo cáo' },
        ]}
        actions={
          <button
            onClick={handleExportReport}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white text-xs font-semibold shadow-sm shadow-[#2E7D4A]/25 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Xuất báo cáo Excel</span>
          </button>
        }
      />

      {/* 2. KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Tổng doanh thu tích lũy"
          value="0 đ"
          change={18.2}
          isPositive={true}
          caption="so với kỳ trước"
          icon={<CircleDollarSign className="w-5 h-5" />}
          tone="primary"
          sparkline={[140, 155, 170, 185, 205, 220, 235, 248]}
        />
        <StatCard
          label="Doanh thu tháng này"
          value="0 đ"
          change={14.8}
          isPositive={true}
          caption="so với tháng 9"
          icon={<Receipt className="w-5 h-5" />}
          tone="success"
          sparkline={[82, 88, 92, 104, 115, 122, 130, 142]}
        />
        <StatCard
          label="Giá trị đơn trung bình"
          value="0 đ"
          change={6.4}
          isPositive={true}
          caption="so với tháng trước"
          icon={<Sparkles className="w-5 h-5" />}
          tone="warning"
          sparkline={[620, 630, 640, 650, 665, 672, 680]}
        />
        <StatCard
          label="Tỷ lệ hoàn thành đơn"
          value="0%"
          change={1.4}
          isPositive={true}
          caption="0 ca thành công"
          icon={<CheckCircle2 className="w-5 h-5" />}
          tone="info"
          sparkline={[96.2, 96.8, 97.4, 97.9, 98.2, 98.6]}
        />
      </div>

      {/* 3. Main Revenue Trend Chart */}
      <SectionCard
        title="Doanh thu theo thời gian"
        subtitle="Biểu đồ so sánh doanh thu thực tế và chu kỳ liền kề"
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Period tabs */}
            <div className="flex items-center p-1 bg-[#F1F5EF] rounded-xl border border-[#E5EBE5]">
              {(['day', 'week', 'month'] as const).map((tab) => {
                const label = tab === 'day' ? 'Hôm nay' : tab === 'week' ? 'Tuần này' : 'Tháng này';
                const isActive = timeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setTimeTab(tab)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-white text-[#2E7D4A] shadow-xs'
                        : 'text-[#66756B] hover:text-[#1C2B20]'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Comparison toggle */}
            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                showComparison
                  ? 'bg-[#EAF5EC] text-[#2E7D4A] border-[#D0E7D5]'
                  : 'bg-white text-[#66756B] border-[#E5EBE5] hover:bg-[#F6F8F4]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showComparison ? 'bg-[#2E7D4A]' : 'bg-slate-300'}`} />
              <span>So với kỳ trước</span>
            </button>
          </div>
        }
      >
        <div className="w-full h-80 sm:h-96 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="currentRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2E7D4A" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2E7D4A" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="prevRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#B4DFC4" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#B4DFC4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDF2EC" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#94A399"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#94A399"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(0)}Tr` : `${v / 1000}k`)}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const cur = payload[0]?.value as number;
                    const prev = payload[1]?.value as number;
                    return (
                      <div className="p-3.5 rounded-xl bg-white border border-[#E5EBE5] shadow-xl text-xs space-y-1.5 font-sans">
                        <div className="font-bold text-[#1C2B20] border-b border-[#F1F5EF] pb-1">
                          {label}
                        </div>
                        <div className="flex items-center justify-between gap-4 text-[#2E7D4A] font-semibold">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#2E7D4A]" /> Kỳ hiện tại:
                          </span>
                          <span>{formatVND(cur)}</span>
                        </div>
                        {prev !== undefined && showComparison && (
                          <div className="flex items-center justify-between gap-4 text-[#66756B]">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#94A399]" /> Kỳ trước:
                            </span>
                            <span>{formatVND(prev)}</span>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="current"
                name="Kỳ hiện tại"
                stroke="#2E7D4A"
                strokeWidth={2.5}
                fill="url(#currentRevGrad)"
              />
              {showComparison && (
                <Area
                  type="monotone"
                  dataKey="previous"
                  name="Kỳ trước"
                  stroke="#94A399"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill="url(#prevRevGrad)"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* 4. Revenue Structure & Regional Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Revenue Structure (Donut) */}
        <SectionCard
          title="Cơ cấu doanh thu"
          subtitle="Tỷ trọng đóng góp theo nhóm dịch vụ"
          className="lg:col-span-1"
        >
          <div className="flex flex-col items-center">
            <div className="w-48 h-48 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={REVENUE_STRUCTURE}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {REVENUE_STRUCTURE.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[11px] text-[#66756B]">Massage tại nhà</span>
                <span className="text-xl font-bold text-[#1C2B20]">58%</span>
              </div>
            </div>

            <div className="w-full space-y-2.5 mt-4 pt-4 border-t border-[#F1F5EF]">
              {REVENUE_STRUCTURE.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-[#1C2B20] font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#1C2B20]">{item.value}%</span>
                    <span className="text-[#94A399]">({(item.revenue / 1000000).toFixed(1)}Tr)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* Right: Regional Revenue Breakdown */}
        <SectionCard
          title="Doanh thu theo khu vực"
          subtitle="Tình hình phân bổ doanh thu tại các thành phố lớn"
          className="lg:col-span-2"
        >
          <div className="space-y-5">
            {REGIONAL_REVENUE.map((reg, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#2E7D4A]" />
                    <span className="font-bold text-[#1C2B20]">{reg.region}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-[#2E7D4A]">{formatVND(reg.revenue)}</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EAF5EC] text-[#2E7D4A]">
                      {reg.share}%
                    </span>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-[#F1F5EF] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#2E7D4A] to-[#41955F] rounded-full transition-all duration-500"
                    style={{ width: `${reg.share}%` }}
                  />
                </div>
              </div>
            ))}

            <div className="p-4 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] flex items-center justify-between text-xs mt-4">
              <span className="text-[#66756B]">
                💡 Khu vực TP. Hồ Chí Minh tiếp tục dẫn đầu với tốc độ tăng trưởng +22% so với tháng trước.
              </span>
              <span className="font-semibold text-[#2E7D4A] flex items-center gap-1 cursor-pointer hover:underline">
                Xem bản đồ nhiệt →
              </span>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* 5. Top Services & Top Technicians */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Services */}
        <SectionCard
          title="Dịch vụ được đặt nhiều nhất"
          subtitle="Xếp hạng theo số lượt hoàn thành và tổng doanh thu"
          action={
            <span className="text-xs text-[#2E7D4A] font-semibold cursor-pointer hover:underline">
              Xem tất cả dịch vụ
            </span>
          }
        >
          <div className="divide-y divide-[#F1F5EF]">
            {TOP_SERVICES.map((srv, idx) => (
              <div key={idx} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-[#EAF5EC] text-[#2E7D4A] font-bold text-xs flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="truncate">
                    <div className="font-bold text-xs text-[#1C2B20] truncate">{srv.name}</div>
                    <div className="text-[11px] text-[#94A399] mt-0.5">{srv.duration} • {srv.bookings} lượt đặt</div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-xs text-[#1C2B20]">{formatVND(srv.revenue)}</div>
                  <div className="text-[11px] text-[#2E9B62] font-semibold flex items-center justify-end gap-0.5 mt-0.5">
                    <TrendingUp className="w-3 h-3" /> {srv.growth}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Top Technicians by Revenue */}
        <SectionCard
          title="Top Kỹ thuật viên theo doanh thu"
          subtitle="Những KTV có doanh thu và tỷ lệ hài lòng cao nhất"
          action={
            <span className="text-xs text-[#2E7D4A] font-semibold cursor-pointer hover:underline">
              Bảng xếp hạng KTV
            </span>
          }
        >
          <div className="divide-y divide-[#F1F5EF]">
            {TOP_TECHNICIANS.map((tech, idx) => (
              <div key={idx} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={tech.avatar}
                    alt={tech.name}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-[#EAF5EC]"
                  />
                  <div className="truncate">
                    <div className="font-bold text-xs text-[#1C2B20] flex items-center gap-1.5">
                      <span>{tech.name}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#FEF6E9] text-[#B87A14] font-semibold">
                        ★ {tech.rating}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#94A399] mt-0.5 truncate">{tech.area} • {tech.completedOrders} ca</div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-xs text-[#2E7D4A]">{formatVND(tech.revenue)}</div>
                  <div className="text-[11px] text-[#66756B] mt-0.5">Hoa hồng hoàn tất</div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </motion.div>
  );
};

export default AnalyticsPage;
