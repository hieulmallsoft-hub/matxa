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
      <div className="p-3.5 rounded-xl bg-[#090C16]/95 border border-white/15 backdrop-blur-xl shadow-2xl text-xs space-y-2 font-mono">
        <div className="text-slate-400 font-semibold border-b border-white/10 pb-1 flex items-center justify-between gap-4">
          <span>{label}</span>
          <span className="text-[10px] text-cyan-400">TELEMETRY POINT</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-cyan-400" /> Revenue:
          </span>
          <span className="font-bold text-white">${revenue?.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-violet-400" /> Orders:
          </span>
          <span className="font-bold text-white">{orders?.toLocaleString()}</span>
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
    <div className="rounded-3xl bg-[#0D101C]/85 border border-white/10 p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute -top-16 -right-16 w-64 h-64 bg-cyan-500/10 rounded-full blur-[80px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <LineChart className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-wide">Revenue Overview</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              REAL-TIME
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic gross transaction volume compared against order settlement rate
          </p>
        </div>

        {/* Tabs and Series Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Period selector */}
          <div className="flex items-center p-1 rounded-xl bg-black/40 border border-white/10">
            {PERIOD_TABS.map((tab) => {
              const isActive = period === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setPeriod(tab.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
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
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                  : 'bg-white/5 border-white/5 text-slate-500 line-through'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>Revenue</span>
            </button>

            <button
              onClick={() =>
                setActiveSeries((prev) => ({ ...prev, orders: !prev.orders }))
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                activeSeries.orders
                  ? 'bg-violet-500/10 border-violet-500/30 text-violet-300'
                  : 'bg-white/5 border-white/5 text-slate-500 line-through'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-violet-400" />
              <span>Orders</span>
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-72 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={currentData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              {/* Cyan gradient for Revenue */}
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
              </linearGradient>

              {/* Violet gradient for Orders */}
              <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />

            <XAxis
              dataKey="date"
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#94A3B8' }}
            />

            <YAxis
              yAxisId="left"
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              tick={{ fill: '#94A3B8' }}
            />

            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
              tick={{ fill: '#94A3B8' }}
            />

            <Tooltip content={<CustomChartTooltip />} />

            {activeSeries.revenue && (
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="revenue"
                name="Revenue"
                stroke="#06B6D4"
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
                stroke="#8B5CF6"
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
      <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span className="font-mono text-cyan-400 font-medium">
            Peak Velocity: $35,030/wk
          </span>
          <span className="hidden sm:inline text-slate-600">•</span>
          <span className="hidden sm:inline text-slate-400">
            Average Basket Size: $428.10
          </span>
        </div>

        <div className="text-[11px] font-mono text-slate-500">
          PROJECTION MODEL: NEURAL ARIMA V2
        </div>
      </div>
    </div>
  );
};

export default RevenueAnalytics;
