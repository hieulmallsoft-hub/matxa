import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Users, UserPlus, Repeat, ShieldCheck, HeartHandshake } from 'lucide-react';
import { CUSTOMER_ANALYTICS_DATA } from '../../data/mockData';

export const CustomerAnalyticsCard: React.FC = () => {
  return (
    <div className="rounded-3xl bg-[#0D101C]/85 border border-white/10 p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-0 w-56 h-56 bg-violet-500/10 rounded-full blur-[80px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-wide">Customer Analytics</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">Acquisition cohorts & long-term retention curve</p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400" /> New
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-violet-500" /> Returning
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-0.5 bg-emerald-400" /> Retention %
          </span>
        </div>
      </div>

      {/* Metric Mini Stat Pill Row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
          <div className="flex items-center gap-1.5 text-cyan-400 text-xs mb-1">
            <UserPlus className="w-3.5 h-3.5" />
            <span className="font-mono text-[10px]">NEW</span>
          </div>
          <div className="text-lg font-bold text-white font-mono">3,922</div>
          <div className="text-[10px] text-emerald-400 font-mono mt-0.5">+18.7% MoM</div>
        </div>

        <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
          <div className="flex items-center gap-1.5 text-violet-400 text-xs mb-1">
            <Repeat className="w-3.5 h-3.5" />
            <span className="font-mono text-[10px]">RETURNING</span>
          </div>
          <div className="text-lg font-bold text-white font-mono">4,180</div>
          <div className="text-[10px] text-emerald-400 font-mono mt-0.5">+11.2% MoM</div>
        </div>

        <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
          <div className="flex items-center gap-1.5 text-emerald-400 text-xs mb-1">
            <HeartHandshake className="w-3.5 h-3.5" />
            <span className="font-mono text-[10px]">RETENTION</span>
          </div>
          <div className="text-lg font-bold text-white font-mono">88.4%</div>
          <div className="text-[10px] text-emerald-400 font-mono mt-0.5">Top 5% SaaS</div>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={CUSTOMER_ANALYTICS_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#94A3B8' }}
            />
            <YAxis
              yAxisId="bars"
              stroke="#64748B"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
              tick={{ fill: '#94A3B8' }}
            />
            <YAxis
              yAxisId="line"
              orientation="right"
              stroke="#64748B"
              fontSize={11}
              domain={[75, 100]}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: '#94A3B8' }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="p-3 rounded-xl bg-slate-900/95 border border-white/15 backdrop-blur-md shadow-2xl text-xs font-mono space-y-1.5">
                      <div className="text-slate-400 font-semibold">{label} Cohort</div>
                      <div className="text-cyan-400">
                        New: {payload[0]?.value?.toLocaleString()}
                      </div>
                      <div className="text-violet-400">
                        Returning: {payload[1]?.value?.toLocaleString()}
                      </div>
                      <div className="text-emerald-400">
                        Retention: {payload[2]?.value}%
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar yAxisId="bars" dataKey="newCustomers" fill="#06B6D4" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar yAxisId="bars" dataKey="returningCustomers" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Line
              yAxisId="line"
              type="monotone"
              dataKey="retentionRate"
              stroke="#10B981"
              strokeWidth={2.5}
              dot={{ fill: '#10B981', r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-500">
        <span>CHURN: 1.2% ANNUALIZED</span>
        <span className="text-emerald-400 font-medium">NPS SCORE: 78 (EXCELLENT)</span>
      </div>
    </div>
  );
};

export default CustomerAnalyticsCard;
