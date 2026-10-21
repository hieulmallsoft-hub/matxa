import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface StatCardProps {
  label?: string;
  title?: string;
  value: string | number;
  change?: number | string;
  isPositive?: boolean;
  caption?: string;
  subValue?: string;
  trend?: { value: number | string; isPositive?: boolean };
  icon: ReactNode;
  sparkline?: number[];
  tone?: 'primary' | 'success' | 'warning' | 'info';
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  title,
  value,
  change,
  isPositive = true,
  caption,
  subValue,
  trend,
  icon,
  sparkline,
  tone = 'primary',
  onClick,
}) => {
  const displayLabel = label || title || '';
  const displayCaption = caption || subValue;
  const displayChange = trend ? trend.value : change;
  const displayIsPositive = trend && trend.isPositive !== undefined ? trend.isPositive : isPositive;

  const toneMap = {
    primary: {
      iconBg: 'bg-[#EAF5EC]',
      iconColor: 'text-[#2E7D4A]',
      sparkColor: '#2E7D4A',
    },
    success: {
      iconBg: 'bg-[#EBF8F1]',
      iconColor: 'text-[#2E9B62]',
      sparkColor: '#2E9B62',
    },
    warning: {
      iconBg: 'bg-[#FEF6E9]',
      iconColor: 'text-[#F2A93B]',
      sparkColor: '#F2A93B',
    },
    info: {
      iconBg: 'bg-[#EDF4FC]',
      iconColor: 'text-[#4285D4]',
      sparkColor: '#4285D4',
    },
  };

  const currentTone = toneMap[tone];

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={`p-5 rounded-2xl bg-white border border-[#E5EBE5] shadow-[0_2px_12px_rgba(28,43,32,0.04)] hover:shadow-[0_8px_24px_rgba(46,125,74,0.08)] hover:border-[#D0DCD1] transition-all flex flex-col justify-between ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-medium text-[#66756B] block tracking-wide">
            {displayLabel}
          </span>
          <div className="text-2xl sm:text-3xl font-bold text-[#1C2B20] mt-1.5 tracking-tight font-sans">
            {value}
          </div>
        </div>

        <div
          className={`w-11 h-11 rounded-xl ${currentTone.iconBg} ${currentTone.iconColor} flex items-center justify-center flex-shrink-0 shadow-sm border border-black/5`}
        >
          {icon}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-[#F1F5EF] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          {displayChange !== undefined && (
            <>
              {displayIsPositive ? (
                <span className="flex items-center gap-0.5 text-[#2E9B62] bg-[#EBF8F1] px-1.5 py-0.5 rounded-md">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {typeof displayChange === 'number' ? `+${displayChange}%` : displayChange}
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-[#E05B55] bg-[#FDF0EF] px-1.5 py-0.5 rounded-md">
                  <TrendingDown className="w-3.5 h-3.5" />
                  {typeof displayChange === 'number' ? `-${displayChange}%` : displayChange}
                </span>
              )}
            </>
          )}
          {displayCaption && (
            <span className="text-[11px] text-[#94A399] font-normal truncate max-w-[180px]">
              {displayCaption}
            </span>
          )}
        </div>

        {/* Optional mini sparkline SVG */}
        {sparkline && sparkline.length > 1 && (
          <div className="w-16 h-7 flex items-end">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 60 24">
              {(() => {
                const min = Math.min(...sparkline);
                const max = Math.max(...sparkline) || 1;
                const range = max - min || 1;
                const points = sparkline
                  .map((val, idx) => {
                    const x = (idx / (sparkline.length - 1)) * 56 + 2;
                    const y = 22 - ((val - min) / range) * 18;
                    return `${x},${y}`;
                  })
                  .join(' ');
                return (
                  <polyline
                    fill="none"
                    stroke={currentTone.sparkColor}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                    opacity="0.85"
                  />
                );
              })()}
            </svg>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default StatCard;
