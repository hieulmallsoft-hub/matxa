import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart as LineChartIcon,
  TrendingUp,
  BarChart3,
  Calendar,
  Layers,
  Zap,
  Target,
  ArrowUpRight,
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
} from 'recharts';

const DETAILED_GROWTH_DATA = [
  { month: 'Jan', revenue: 64000, target: 60000, margin: 42 },
  { month: 'Feb', revenue: 72000, target: 68000, margin: 44 },
  { month: 'Mar', revenue: 84000, target: 76000, margin: 45 },
  { month: 'Apr', revenue: 91000, target: 85000, margin: 46 },
  { month: 'May', revenue: 104000, target: 95000, margin: 48 },
  { month: 'Jun', revenue: 112000, target: 102000, margin: 49 },
  { month: 'Jul', revenue: 118000, target: 110000, margin: 49 },
  { month: 'Aug', revenue: 122000, target: 115000, margin: 51 },
  { month: 'Sep', revenue: 125000, target: 120000, margin: 52 },
  { month: 'Oct', revenue: 128430, target: 122000, margin: 53 },
];

const TRAFFIC_SOURCES = [
  { source: 'Direct Enterprise API', volume: '48.2%', latency: '12ms', status: 'Optimal' },
  { source: 'Stripe Global Webhook', volume: '26.4%', latency: '18ms', status: 'Optimal' },
  { source: 'Autonomous Agent SDK', volume: '14.1%', latency: '22ms', status: 'Optimal' },
  { source: 'Partner Ecosystem', volume: '11.3%', latency: '35ms', status: 'Nominal' },
];

export const AnalyticsPage: React.FC = () => {
  const [metricTab, setMetricTab] = useState<'revenue' | 'margin'>('revenue');

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.4 }}
      className="space-y-8 pb-16"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-[#0D101C]/80 border border-white/10 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <LineChartIcon className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">
              Advanced Telemetry Analytics
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Deep multi-dimensional financial modeling, margin telemetry, and target deviations
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-slate-300">
            MODEL: MONTE-CARLO V4
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            CONFIDENCE: 98.7%
          </span>
        </div>
      </div>

      {/* KPI Highlight Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Annual Run Rate (ARR)', value: '$1.54M', change: '+22.4%', color: 'text-cyan-400' },
          { label: 'Gross Margin (Blended)', value: '53.2%', change: '+3.8%', color: 'text-emerald-400' },
          { label: 'Customer Acquisition Cost', value: '$142.50', change: '-8.1%', color: 'text-violet-400' },
          { label: 'LTV to CAC Ratio', value: '10.4x', change: '+1.2x', color: 'text-amber-400' },
        ].map((kpi, i) => (
          <div key={i} className="p-5 rounded-2xl bg-[#0E1220]/80 border border-white/10 backdrop-blur-xl">
            <span className="text-[11px] font-mono text-slate-400 uppercase">{kpi.label}</span>
            <div className={`text-2xl font-bold font-mono ${kpi.color} mt-1`}>{kpi.value}</div>
            <div className="text-[11px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> {kpi.change} vs projection
            </div>
          </div>
        ))}
      </div>

      {/* Revenue vs Target Projection Chart */}
      <div className="p-6 rounded-3xl bg-[#0D101C]/80 border border-white/10 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-bold text-white">Revenue vs Target Trajectory</h2>
            <p className="text-xs text-slate-400 mt-0.5">Historical fulfillment vs neural forecast</p>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Actual Revenue
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600" /> Target Benchmark
            </span>
          </div>
        </div>

        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={DETAILED_GROWTH_DATA}>
              <defs>
                <linearGradient id="actualRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" stroke="#64748B" fontSize={11} tickLine={false} />
              <YAxis
                stroke="#64748B"
                fontSize={11}
                tickLine={false}
                tickFormatter={(v) => `$${v / 1000}k`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="p-3 rounded-xl bg-slate-900 border border-white/10 text-xs font-mono space-y-1">
                        <div className="text-white font-bold">{label} 2026</div>
                        <div className="text-cyan-400">
                          Actual: ${payload[0]?.value?.toLocaleString()}
                        </div>
                        <div className="text-slate-400">
                          Target: ${payload[1]?.value?.toLocaleString()}
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
                stroke="#06B6D4"
                strokeWidth={2.5}
                fill="url(#actualRevGrad)"
              />
              <Area
                type="monotone"
                dataKey="target"
                stroke="#64748B"
                strokeWidth={2}
                strokeDasharray="4 4"
                fill="transparent"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Traffic Sources & Ingestion Table */}
      <div className="p-6 rounded-3xl bg-[#0D101C]/80 border border-white/10 backdrop-blur-xl">
        <h2 className="text-base font-bold text-white mb-4">Ingestion Pipelines & Latency</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-white/5 text-slate-500 uppercase text-[10px]">
                <th className="py-3 px-3">Telemetry Channel</th>
                <th className="py-3 px-3">Traffic Share</th>
                <th className="py-3 px-3">End-to-End Latency</th>
                <th className="py-3 px-3">Cluster Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {TRAFFIC_SOURCES.map((ts, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02]">
                  <td className="py-3.5 px-3 text-white font-semibold">{ts.source}</td>
                  <td className="py-3.5 px-3 text-cyan-400">{ts.volume}</td>
                  <td className="py-3.5 px-3 text-slate-300">{ts.latency}</td>
                  <td className="py-3.5 px-3 text-emerald-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {ts.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

export default AnalyticsPage;
