import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { PieChart as PieIcon, ArrowUpRight, TrendingUp } from 'lucide-react';
import { SALES_CHANNELS } from '../../data/mockData';

export const SalesOverviewDonut: React.FC = () => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const totalRevenue = SALES_CHANNELS.reduce((acc, curr) => acc + curr.revenue, 0);

  return (
    <div className="rounded-3xl bg-[#001910]/90 border border-[#385723]/40 p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[#385723]/20 rounded-full blur-[60px] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#385723]/30 border border-[#94AB71]/40 text-[#C7D9B5]">
              <PieIcon className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-[#FFFAF5] tracking-wide">Kênh Doanh Thu</h2>
          </div>
          <p className="text-xs text-[#C7D9B5]/80 mt-1">Phân bổ nguồn thu dịch vụ & liệu trình</p>
        </div>

        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#385723]/30 text-[#C7D9B5] border border-[#94AB71]/40">
          5 KÊNH
        </span>
      </div>

      {/* Donut Chart with Center Metric */}
      <div className="relative w-full h-56 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={SALES_CHANNELS}
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={92}
              paddingAngle={4}
              dataKey="value"
              animationBegin={200}
              animationDuration={1200}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {SALES_CHANNELS.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke="#001910"
                  strokeWidth={2}
                  style={{
                    filter: activeIndex === index ? `drop-shadow(0 0 8px ${entry.color})` : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="px-3 py-2 rounded-xl bg-[#001910]/95 border border-[#385723]/60 backdrop-blur-md shadow-2xl text-xs font-mono">
                      <div className="font-semibold text-[#FFFAF5]">{data.name}</div>
                      <div className="text-[#F9EDB2] mt-0.5">
                        ${data.revenue.toLocaleString()} ({data.value}%)
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] font-mono text-[#C7D9B5]/80 uppercase tracking-wider">
            Tổng Thu
          </span>
          <span className="text-xl font-bold text-[#FFFAF5] tracking-tight mt-0.5">
            ${(totalRevenue / 1000).toFixed(1)}k
          </span>
          <span className="text-[10px] text-[#94AB71] font-mono flex items-center gap-0.5">
            <TrendingUp className="w-2.5 h-2.5" /> +14.2% MoM
          </span>
        </div>
      </div>

      {/* Legend & Channel Progress Bars */}
      <div className="space-y-2.5 mt-2">
        {SALES_CHANNELS.map((channel, idx) => {
          const isHovered = activeIndex === idx;
          return (
            <div
              key={channel.name}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseLeave={() => setActiveIndex(null)}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                isHovered ? 'bg-[#385723]/30 border border-[#94AB71]/40' : 'hover:bg-[#385723]/15'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: channel.color }}
                  />
                  <span className="text-[#C7D9B5] font-medium">{channel.name}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-[#FFFAF5] font-semibold">${channel.revenue.toLocaleString()}</span>
                  <span className="text-[#94AB71] text-[11px]">({channel.value}%)</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1 bg-[#001910] border border-[#385723]/30 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${channel.value}%` }}
                  transition={{ duration: 1, delay: 0.2 + idx * 0.1 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: channel.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SalesOverviewDonut;
