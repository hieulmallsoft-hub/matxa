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
import { Users, UserPlus, Repeat, HeartHandshake } from 'lucide-react';
import { CUSTOMER_ANALYTICS_DATA } from '../../data/mockData';

export const CustomerAnalyticsCard: React.FC = () => {
  return (
    <div className="rounded-2xl bg-white border border-[#E5EBE5] p-5 shadow-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#EAF5EC] text-[#2E7D4A]">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-[#1C2B20]">Khách Hàng & Thành Viên</h2>
          </div>
          <p className="text-xs text-[#66756B] mt-0.5">Phân tích hội viên mới, quay lại & tỷ lệ giữ chân liệu trình</p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-[#66756B]">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#2E7D4A]" /> Mới
          </span>
          <span className="flex items-center gap-1.5 text-[#66756B]">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#A3D9B1]" /> Quay lại
          </span>
          <span className="flex items-center gap-1.5 text-[#F2A93B]">
            <span className="w-2 h-0.5 bg-[#F2A93B]" /> Giữ chân %
          </span>
        </div>
      </div>

      {/* Metric Mini Stat Pill Row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="p-3 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5]">
          <div className="flex items-center gap-1.5 text-[#2E7D4A] text-xs mb-1">
            <UserPlus className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold">MỚI</span>
          </div>
          <div className="text-lg font-bold text-[#1C2B20]">3.922</div>
          <div className="text-[11px] text-[#2E7D4A] font-medium mt-0.5">+18.7% MoM</div>
        </div>

        <div className="p-3 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5]">
          <div className="flex items-center gap-1.5 text-[#66756B] text-xs mb-1">
            <Repeat className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold">QUAY LẠI</span>
          </div>
          <div className="text-lg font-bold text-[#1C2B20]">4.180</div>
          <div className="text-[11px] text-[#2E7D4A] font-medium mt-0.5">+11.2% MoM</div>
        </div>

        <div className="p-3 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5]">
          <div className="flex items-center gap-1.5 text-[#F2A93B] text-xs mb-1">
            <HeartHandshake className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold">GIỮ CHÂN</span>
          </div>
          <div className="text-lg font-bold text-[#1C2B20]">88.4%</div>
          <div className="text-[11px] text-[#2E7D4A] font-medium mt-0.5">Top 5% Spa</div>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={CUSTOMER_ANALYTICS_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5EBE5" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="#66756B"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="bars"
              stroke="#66756B"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
            />
            <YAxis
              yAxisId="line"
              orientation="right"
              stroke="#F2A93B"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#FFFFFF',
                borderColor: '#E5EBE5',
                borderRadius: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                fontSize: '12px',
                color: '#1C2B20',
              }}
            />
            <Bar yAxisId="bars" dataKey="newUsers" fill="#2E7D4A" radius={[4, 4, 0, 0]} name="Khách mới" />
            <Bar yAxisId="bars" dataKey="returningUsers" fill="#A3D9B1" radius={[4, 4, 0, 0]} name="Khách quay lại" />
            <Line
              yAxisId="line"
              type="monotone"
              dataKey="retentionRate"
              stroke="#F2A93B"
              strokeWidth={2.5}
              dot={{ fill: '#F2A93B', r: 3 }}
              name="Tỷ lệ giữ chân (%)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
