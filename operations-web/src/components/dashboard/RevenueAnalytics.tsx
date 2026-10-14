import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { LineChart, Layers, Download, Maximize2 } from 'lucide-react';
import { REVENUE_DATA } from '../../data/mockData';
import { TimePeriod } from '../../types/dashboard';

const PERIOD_TABS: { key: TimePeriod; label: string }[] = [
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '3m', label: '3 Months' },
  { key: '1y', label: '1 Year' },
];

// Custom futuristic tooltip
const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const revenue = payload.find((p: any) => p.dataKey === 'revenue')?.value;
    const orders = payload.find((p: any) => p.dataKey === 'orders')?.value;

    return (
      <div className="p-3.5 rounded-xl bg-[#001910]/95 border border-[#385723]/60 backdrop-blur-xl shadow-2xl text-xs space-y-2 font-mono">
        <div className="text-[#C7D9B5] font-semibold border-b border-[#385723]/40 pb-1 flex items-center justify-between gap-4">
          <span>{label}</span>
          <span className="text-[10px] text-[#F9EDB2]">CHỈ SỐ THEO DÕI</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-[#C7D9B5]/90">
            <span className="w-2 h-2 rounded-full bg-[#94AB71]" /> Doanh thu:
          </span>
          <span className="font-bold text-[#FFFAF5]">${revenue?.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-[#C7D9B5]/90">
            <span className="w-2 h-2 rounded-full bg-[#F9EDB2]" /> Đơn dịch vụ:
          </span>
          <span className="font-bold text-[#FFFAF5]">{orders?.toLocaleString()}</span>
        </div>
      </div>
    );
  }
  return null;
};

export const RevenueAnalytics: React.FC = () => {
  const [period, setPeriod] = useState<TimePeriod>('30d');
  const [activeSeries, setActiveSeries] = useState<{ revenue: boolean; orders: boolean }>({
    revenue: true,
    orders: true,
  });

  const currentData = REVENUE_DATA[period] || REVENUE_DATA['30d'];

  return (
    <div className="rounded-3xl bg-[#001910]/90 border border-[#385723]/40 p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute -top-16 -right-16 w-64 h-64 bg-[#385723]/25 rounded-full blur-[80px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#385723]/30 border border-[#94AB71]/40 text-[#C7D9B5]">
              <LineChart className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-[#FFFAF5] tracking-wide">Doanh Thu & Dịch Vụ Spa</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#385723]/40 text-[#C7D9B5] border border-[#94AB71]/40">
              TRỰC TIẾP
            </span>
          </div>
          <p className="text-xs text-[#C7D9B5]/80 mt-1">
            Tổng giá trị gói trị liệu, voucher và số lượng lịch phục vụ hoàn thành theo thời gian
          </p>
        </div>

        {/* Tabs and Series Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center p-1 rounded-xl bg-[#001910]/80 border border-[#385723]/50">
            {PERIOD_TABS.map((tab) => {
              const isActive = period === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setPeriod(tab.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-[#385723] to-[#4d7530] text-[#FFFAF5] shadow-sm border border-[#94AB71]/40 font-semibold'
                      : 'text-[#C7D9B5]/70 hover:text-[#FFFAF5]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Series filter toggles */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <button
              onClick={() =>
                setActiveSeries((prev) => ({ ...prev, revenue: !prev.revenue }))
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                activeSeries.revenue
                  ? 'bg-[#385723]/35 border-[#94AB71]/50 text-[#C7D9B5]'
                  : 'bg-white/5 border-white/5 text-slate-500 line-through'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#94AB71]" />
              <span>Doanh thu</span>
            </button>

            <button
              onClick={() =>
                setActiveSeries((prev) => ({ ...prev, orders: !prev.orders }))
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                activeSeries.orders
                  ? 'bg-[#F9EDB2]/20 border-[#F9EDB2]/40 text-[#F9EDB2]'
                  : 'bg-white/5 border-white/5 text-slate-500 line-through'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#F9EDB2]" />
              <span>Lịch hẹn</span>
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-72 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {/* Olive Sage gradient for Revenue */}
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#94AB71" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#94AB71" stopOpacity={0.0} />
              </linearGradient>

              {/* Chamomile Gold gradient for Orders */}
              <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F9EDB2" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#F9EDB2" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(199, 217, 181, 0.08)" vertical={false} />

            <XAxis
              dataKey="date"
              stroke="#94AB71"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#C7D9B5' }}
            />

            <YAxis
              yAxisId="left"
              stroke="#94AB71"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              tick={{ fill: '#C7D9B5' }}
            />

            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#F9EDB2"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
              tick={{ fill: '#F9EDB2' }}
            />

            <Tooltip content={<CustomChartTooltip />} />

            {activeSeries.revenue && (
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="#94AB71"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorRevenue)"
                animationDuration={1000}
              />
            )}

            {activeSeries.orders && (
              <Area
                yAxisId="right"
                type="monotone"
                dataKey="orders"
                name="Orders"
                stroke="#F9EDB2"
                strokeWidth={2}
                strokeDasharray="4 4"
                fillOpacity={1}
                fill="url(#colorOrders)"
                animationDuration={1000}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Insights row */}
      <div className="mt-4 pt-3 border-t border-[#385723]/30 flex flex-wrap items-center justify-between text-xs text-[#C7D9B5]/80">
        <div className="flex items-center gap-4">
          <span className="font-mono text-[#F9EDB2] font-semibold">
            Tốc độ đỉnh: $35,030/tuần
          </span>
          <span className="hidden sm:inline text-[#385723]">•</span>
          <span className="hidden sm:inline text-[#C7D9B5]">
            Giá trị dịch vụ TB: $428.10
          </span>
        </div>

        <div className="text-[11px] font-mono text-[#94AB71]/80">
          MÔ HÌNH DỰ BÁO: MATXA BIO-PROJECTION V2
        </div>
      </div>
    </div>
  );
};

export default RevenueAnalytics;
