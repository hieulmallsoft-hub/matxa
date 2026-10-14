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
    <div className="rounded-3xl bg-[#001910]/90 border border-[#385723]/40 p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-0 w-56 h-56 bg-[#385723]/20 rounded-full blur-[80px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#385723]/30 border border-[#94AB71]/40 text-[#C7D9B5]">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-[#FFFAF5] tracking-wide">Khách Hàng & Thành Viên</h2>
          </div>
          <p className="text-xs text-[#C7D9B5]/80 mt-1">Phân tích hội viên mới, quay lại & tỷ lệ tái sử dụng liệu trình</p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-[#C7D9B5]">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#94AB71]" /> Mới
          </span>
          <span className="flex items-center gap-1.5 text-[#C7D9B5]">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#385723]" /> Quay lại
          </span>
          <span className="flex items-center gap-1.5 text-[#F9EDB2]">
            <span className="w-2 h-0.5 bg-[#F9EDB2]" /> Giữ chân %
          </span>
        </div>
      </div>

      {/* Metric Mini Stat Pill Row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="p-3 rounded-2xl bg-[#001910]/80 border border-[#385723]/40">
          <div className="flex items-center gap-1.5 text-[#94AB71] text-xs mb-1">
            <UserPlus className="w-3.5 h-3.5" />
            <span className="font-mono text-[10px]">MỚI</span>
          </div>
          <div className="text-lg font-bold text-[#FFFAF5] font-mono">3,922</div>
          <div className="text-[10px] text-[#94AB71] font-mono mt-0.5">+18.7% MoM</div>
        </div>

        <div className="p-3 rounded-2xl bg-[#001910]/80 border border-[#385723]/40">
          <div className="flex items-center gap-1.5 text-[#C7D9B5] text-xs mb-1">
            <Repeat className="w-3.5 h-3.5" />
            <span className="font-mono text-[10px]">QUAY LẠI</span>
          </div>
          <div className="text-lg font-bold text-[#FFFAF5] font-mono">4,180</div>
          <div className="text-[10px] text-[#94AB71] font-mono mt-0.5">+11.2% MoM</div>
        </div>

        <div className="p-3 rounded-2xl bg-[#001910]/80 border border-[#385723]/40">
          <div className="flex items-center gap-1.5 text-[#F9EDB2] text-xs mb-1">
            <HeartHandshake className="w-3.5 h-3.5" />
            <span className="font-mono text-[10px]">GIỮ CHÂN</span>
          </div>
          <div className="text-lg font-bold text-[#FFFAF5] font-mono">88.4%</div>
          <div className="text-[10px] text-[#F9EDB2] font-mono mt-0.5">Top 5% Spa</div>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={CUSTOMER_ANALYTICS_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(199, 217, 181, 0.08)" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="#94AB71"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#C7D9B5' }}
            />
            <YAxis
              yAxisId="bars"
              stroke="#94AB71"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
              tick={{ fill: '#C7D9B5' }}
            />
            <YAxis
              yAxisId="line"
              orientation="right"
              stroke="#F9EDB2"
              fontSize={11}
              domain={[75, 100]}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: '#F9EDB2' }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="p-3 rounded-xl bg-[#001910]/95 border border-[#385723]/60 backdrop-blur-md shadow-2xl text-xs font-mono space-y-1.5">
                      <div className="text-[#C7D9B5] font-semibold">{label} Cohort</div>
                      <div className="text-[#94AB71]">
                        Mới: {payload[0]?.value?.toLocaleString()}
                      </div>
                      <div className="text-[#C7D9B5]">
                        Quay lại: {payload[1]?.value?.toLocaleString()}
                      </div>
                      <div className="text-[#F9EDB2]">
                        Giữ chân: {payload[2]?.value}%
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar yAxisId="bars" dataKey="newCustomers" fill="#94AB71" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar yAxisId="bars" dataKey="returningCustomers" fill="#385723" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Line
              yAxisId="line"
              type="monotone"
              dataKey="retentionRate"
              stroke="#F9EDB2"
              strokeWidth={2.5}
              dot={{ fill: '#F9EDB2', r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-[#385723]/30 flex items-center justify-between text-[11px] font-mono text-[#C7D9B5]/70">
        <span>TỶ LỆ RỜI BỎ: 1.2% / NĂM</span>
        <span className="text-[#F9EDB2] font-semibold">ĐIỂM HÀI LÒNG: 94/100 (XUẤT SẮC)</span>
      </div>
    </div>
  );
};

export default CustomerAnalyticsCard;
