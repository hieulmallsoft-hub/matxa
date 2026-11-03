import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart as LineChartIcon,
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
import { request } from '../api/client';

// Vietnamese currency formatter
const formatVND = (val: number) => `${new Intl.NumberFormat('vi-VN').format(val)} đ`;

type Period = 'day' | 'week' | 'month';
type RevenueReport = {
  kpis: {
    totalRevenue: number;
    revenueThisMonth: number;
    revenueLastMonth: number;
    averageOrderValue: number;
    averageOrderValueLastMonth: number;
    completedThisMonth: number;
    completionRate: number;
    completionRateLastMonth: number;
  };
  timeline: { label: string; current: number; previous: number }[];
  periodRevenue: number;
  byCategory: { name: string; revenue: number; bookings: number; share: number }[];
  byRegion: { region: string; revenue: number; bookings: number; share: number }[];
  topServices: { name: string; duration: number; revenue: number; bookings: number; share: number }[];
  topTechnicians: { name: string; avatarUrl: string | null; area: string; rating: number; revenue: number; completedOrders: number }[];
};

const PERIOD_LABELS: Record<Period, string> = { day: 'Hôm nay', week: 'Tuần này', month: 'Năm nay' };
const COMPARE_LABELS: Record<Period, string> = { day: 'hôm qua', week: 'tuần trước', month: 'cùng kỳ năm trước' };
const CATEGORY_COLORS = ['#2E7D4A', '#41955F', '#AEE4BB', '#F2A93B', '#5B8DEF', '#B47AE0', '#94A399'];

/** Percent change vs. a previous value; undefined when there is nothing to compare with. */
function change(current: number, previous: number) {
  if (!previous) return undefined;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function EmptyRows({ text }: { text: string }) {
  return <div className="py-10 text-center text-xs text-[#94A399]">{text}</div>;
}

export const AnalyticsPage: React.FC = () => {
  const { addToast } = useToast();
  const [timeTab, setTimeTab] = useState<Period>('month');
  const [showComparison, setShowComparison] = useState(true);
  const [report, setReport] = useState<RevenueReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    request<RevenueReport>(`/admin/marketplace/reports/revenue?period=${timeTab}`)
      .then((data) => !cancelled && setReport(data))
      .catch((e) =>
        addToast({ title: 'Không tải được báo cáo', message: e instanceof Error ? e.message : '', type: 'error' }),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeTab]);

  const handleExportReport = () => {
    if (!report) return;
    const csv = (rows: (string | number)[][]) => rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const content = [
      csv([[`Doanh thu - ${PERIOD_LABELS[timeTab]}`], ['Mốc', 'Kỳ hiện tại', `Kỳ so sánh (${COMPARE_LABELS[timeTab]})`]]),
      csv(report.timeline.map((r) => [r.label, r.current, r.previous])),
      csv([[], ['Nhóm dịch vụ', 'Doanh thu', 'Lượt', 'Tỷ trọng %']]),
      csv(report.byCategory.map((r) => [r.name, r.revenue, r.bookings, r.share])),
      csv([[], ['Khu vực', 'Doanh thu', 'Đơn', 'Tỷ trọng %']]),
      csv(report.byRegion.map((r) => [r.region, r.revenue, r.bookings, r.share])),
      csv([[], ['Dịch vụ', 'Doanh thu', 'Lượt', 'Tỷ trọng %']]),
      csv(report.topServices.map((r) => [r.name, r.revenue, r.bookings, r.share])),
      csv([[], ['Kỹ thuật viên', 'Khu vực', 'Doanh thu', 'Số ca', 'Đánh giá']]),
      csv(report.topTechnicians.map((r) => [r.name, r.area, r.revenue, r.completedOrders, r.rating])),
    ].join('\n');
    // BOM so Excel opens the Vietnamese text as UTF-8.
    const url = URL.createObjectURL(new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `bao-cao-doanh-thu-${timeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const kpis = report?.kpis;
  const chartData = report?.timeline ?? [];
  const topCategory = report?.byCategory[0];
  const lastMonthLabel = `tháng ${((new Date().getMonth() + 11) % 12) + 1}`;
  const kpiChange = (current: number, previous: number) => {
    const value = change(current, previous);
    return value === undefined ? {} : { change: Math.abs(value), isPositive: value >= 0 };
  };

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
        badge="Từ đơn đã hoàn thành"
        badgeTone="green"
        breadcrumbs={[
          { label: 'MATXXA' },
          { label: 'Doanh thu & Báo cáo' },
        ]}
        actions={
          <button
            onClick={handleExportReport}
            disabled={!report}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white text-xs font-semibold shadow-sm shadow-[#2E7D4A]/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
          value={kpis ? formatVND(kpis.totalRevenue) : '–'}
          caption="tất cả đơn đã hoàn thành"
          icon={<CircleDollarSign className="w-5 h-5" />}
          tone="primary"
        />
        <StatCard
          label="Doanh thu tháng này"
          value={kpis ? formatVND(kpis.revenueThisMonth) : '–'}
          {...(kpis ? kpiChange(kpis.revenueThisMonth, kpis.revenueLastMonth) : {})}
          caption={`so với ${lastMonthLabel}`}
          icon={<Receipt className="w-5 h-5" />}
          tone="success"
        />
        <StatCard
          label="Giá trị đơn trung bình"
          value={kpis ? formatVND(kpis.averageOrderValue) : '–'}
          {...(kpis ? kpiChange(kpis.averageOrderValue, kpis.averageOrderValueLastMonth) : {})}
          caption="tháng này so với tháng trước"
          icon={<Sparkles className="w-5 h-5" />}
          tone="warning"
        />
        <StatCard
          label="Tỷ lệ hoàn thành đơn"
          value={kpis ? `${kpis.completionRate}%` : '–'}
          {...(kpis ? kpiChange(kpis.completionRate, kpis.completionRateLastMonth) : {})}
          caption={kpis ? `${kpis.completedThisMonth} ca thành công tháng này` : undefined}
          icon={<CheckCircle2 className="w-5 h-5" />}
          tone="info"
        />
      </div>

      {/* 3. Main Revenue Trend Chart */}
      <SectionCard
        title="Doanh thu theo thời gian"
        subtitle={`${PERIOD_LABELS[timeTab]}: ${formatVND(report?.periodRevenue ?? 0)} · đường nét đứt là ${COMPARE_LABELS[timeTab]}`}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Period tabs */}
            <div className="flex items-center p-1 bg-[#F1F5EF] rounded-xl border border-[#E5EBE5]">
              {(['day', 'week', 'month'] as const).map((tab) => {
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
                    {PERIOD_LABELS[tab]}
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
        <div className={`w-full h-80 sm:h-96 pt-2 transition-opacity ${loading ? 'opacity-40' : ''}`}>
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
          subtitle={`Tỷ trọng theo nhóm dịch vụ · ${PERIOD_LABELS[timeTab].toLowerCase()}`}
          className="lg:col-span-1"
        >
          {!report?.byCategory.length ? (
            <EmptyRows text="Chưa có đơn hoàn thành trong kỳ này" />
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-48 h-48 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={report.byCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="revenue"
                    >
                      {report.byCategory.map((entry, index) => (
                        <Cell key={entry.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-8 text-center">
                  <span className="text-[11px] text-[#66756B] truncate max-w-full">{topCategory?.name}</span>
                  <span className="text-xl font-bold text-[#1C2B20]">{topCategory?.share}%</span>
                </div>
              </div>

              <div className="w-full space-y-2.5 mt-4 pt-4 border-t border-[#F1F5EF]">
                {report.byCategory.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}
                      />
                      <span className="text-[#1C2B20] font-medium truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-semibold text-[#1C2B20]">{item.share}%</span>
                      <span className="text-[#94A399]">({formatVND(item.revenue)})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        {/* Right: Regional Revenue Breakdown */}
        <SectionCard
          title="Doanh thu theo khu vực"
          subtitle="Theo tỉnh/thành của địa chỉ phục vụ"
          className="lg:col-span-2"
        >
          {!report?.byRegion.length ? (
            <EmptyRows text="Chưa có đơn hoàn thành trong kỳ này" />
          ) : (
            <div className="space-y-5">
              {report.byRegion.map((reg) => (
                <div key={reg.region} className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#2E7D4A]" />
                      <span className="font-bold text-[#1C2B20]">{reg.region}</span>
                      <span className="text-[#94A399]">{reg.bookings} đơn</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[#2E7D4A]">{formatVND(reg.revenue)}</span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EAF5EC] text-[#2E7D4A]">
                        {reg.share}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#F1F5EF] overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#2E7D4A] to-[#41955F] rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${reg.share}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* 5. Top Services & Top Technicians */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Services */}
        <SectionCard
          title="Dịch vụ được đặt nhiều nhất"
          subtitle={`Xếp hạng theo doanh thu · ${PERIOD_LABELS[timeTab].toLowerCase()}`}
        >
          {!report?.topServices.length ? (
            <EmptyRows text="Chưa có đơn hoàn thành trong kỳ này" />
          ) : (
            <div className="divide-y divide-[#F1F5EF]">
              {report.topServices.map((srv, idx) => (
                <div key={srv.name} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-[#EAF5EC] text-[#2E7D4A] font-bold text-xs flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <div className="truncate">
                      <div className="font-bold text-xs text-[#1C2B20] truncate">{srv.name}</div>
                      <div className="text-[11px] text-[#94A399] mt-0.5">{srv.duration} phút • {srv.bookings} lượt đặt</div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-xs text-[#1C2B20]">{formatVND(srv.revenue)}</div>
                    <div className="text-[11px] text-[#66756B] mt-0.5">{srv.share}% doanh thu</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Top Technicians by Revenue */}
        <SectionCard
          title="Top Kỹ thuật viên theo doanh thu"
          subtitle={`Doanh thu các đơn KTV đã hoàn thành · ${PERIOD_LABELS[timeTab].toLowerCase()}`}
        >
          {!report?.topTechnicians.length ? (
            <EmptyRows text="Chưa có đơn hoàn thành trong kỳ này" />
          ) : (
            <div className="divide-y divide-[#F1F5EF]">
              {report.topTechnicians.map((tech) => (
                <div key={tech.name + tech.area} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {tech.avatarUrl ? (
                      <img
                        src={tech.avatarUrl}
                        alt={tech.name}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-[#EAF5EC]"
                      />
                    ) : (
                      <span className="w-10 h-10 rounded-full bg-[#EAF5EC] text-[#2E7D4A] font-bold text-sm flex items-center justify-center ring-2 ring-[#EAF5EC]">
                        {tech.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="truncate">
                      <div className="font-bold text-xs text-[#1C2B20] flex items-center gap-1.5">
                        <span>{tech.name}</span>
                        {tech.rating > 0 && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#FEF6E9] text-[#B87A14] font-semibold">
                            ★ {tech.rating}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#94A399] mt-0.5 truncate">
                        {tech.area ? `${tech.area} • ` : ''}{tech.completedOrders} ca
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-xs text-[#2E7D4A]">{formatVND(tech.revenue)}</div>
                    <div className="text-[11px] text-[#66756B] mt-0.5">Doanh thu hoàn tất</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </motion.div>
  );
};

export default AnalyticsPage;
