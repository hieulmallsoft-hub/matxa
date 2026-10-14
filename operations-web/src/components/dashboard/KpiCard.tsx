import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Users,
  Percent,
  ArrowUpRight,
} from 'lucide-react';
import { KpiMetric } from '../../types/dashboard';
import { TiltCard } from '../ui/TiltCard';

interface KpiCardProps {
  metric: KpiMetric;
  index: number;
}

const ICONS = {
  'kpi-revenue': DollarSign,
  'kpi-orders': ShoppingBag,
  'kpi-customers': Users,
  'kpi-conversion': Percent,
};

const ACCENT_STYLES = {
  blue: {
    bgGlow: 'rgba(34, 160, 74, 0.18)',
    iconBg: 'bg-[#f0faf2] text-[#156b2e] border border-[rgba(34,160,74,0.22)]',
    gradientStroke: '#22a04a',
  },
  cyan: {
    bgGlow: 'rgba(56, 182, 94, 0.15)',
    iconBg: 'bg-[#d8f3df] text-[#22a04a] border border-[rgba(56,182,94,0.30)]',
    gradientStroke: '#38b65e',
  },
  violet: {
    bgGlow: 'rgba(245, 158, 11, 0.15)',
    iconBg: 'bg-[#fef9ee] text-[#b45309] border border-[rgba(245,158,11,0.28)]',
    gradientStroke: '#f59e0b',
  },
  emerald: {
    bgGlow: 'rgba(34, 160, 74, 0.14)',
    iconBg: 'bg-[#eef8f1] text-[#1a8a3c] border border-[rgba(34,160,74,0.20)]',
    gradientStroke: '#22a04a',
  },
};

// Mini SVG Sparkline Component
const MiniSparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 110;
  const height = 36;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = `${points} ${width},${height} 0,${height}`;
  const gradientId = `sparkline-grad-${color.replace('#', '')}`;

  return (
    <div className="w-28 h-9 flex items-center justify-end">
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <polygon points={areaPoints} fill={`url(#${gradientId})`} />
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </div>
  );
};

export const KpiCard: React.FC<KpiCardProps> = ({ metric, index }) => {
  const Icon = ICONS[metric.id as keyof typeof ICONS] || DollarSign;
  const style = ACCENT_STYLES[metric.accent] || ACCENT_STYLES.blue;

  // Count-up display animation
  const [displayValue, setDisplayValue] = useState(metric.value);

  useEffect(() => {
    let start = 0;
    const duration = 1200;
    const startTime = performance.now();

    const updateCounter = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out expo
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

      if (metric.id === 'kpi-conversion') {
        const val = (metric.numericValue * ease).toFixed(2);
        setDisplayValue(`${val}%`);
      } else if (metric.id === 'kpi-revenue') {
        const val = Math.floor(metric.numericValue * ease).toLocaleString();
        setDisplayValue(`$${val}`);
      } else {
        const val = Math.floor(metric.numericValue * ease).toLocaleString();
        setDisplayValue(val);
      }

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        setDisplayValue(metric.value);
      }
    };

    requestAnimationFrame(updateCounter);
  }, [metric]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 25 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <TiltCard
        glowColor={style.bgGlow}
        className="p-5 sm:p-6 bg-white border border-[rgba(34,160,74,0.14)] hover:border-[rgba(34,160,74,0.35)] transition-all rounded-2xl shadow-[0_2px_10px_rgba(10,80,30,0.07)]"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${style.iconBg}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#5a8a68] tracking-wide uppercase">
                {metric.title}
              </span>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0d3318] mt-0.5" style={{fontFamily: 'Quicksand, Nunito, sans-serif'}}>
                {displayValue}
              </div>
            </div>
          </div>

          {/* Percentage badge */}
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
              metric.isPositive
                ? 'bg-[#d8f3df] text-[#156b2e] border border-[rgba(34,160,74,0.28)]'
                : 'bg-[#fee2e2] text-[#8a1c1c] border border-[rgba(229,62,62,0.25)]'
            }`}
          >
            {metric.isPositive ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            <span>
              {metric.isPositive ? '+' : ''}
              {metric.change}%
            </span>
          </div>
        </div>

        {/* Bottom row: Sparkline & Comparison Text */}
        <div className="pt-2 border-t border-[rgba(34,160,74,0.12)] flex items-end justify-between">
          <div className="space-y-0.5">
            <div className="text-[11px] text-[#5a8a68] font-medium">
              {metric.comparisonText}
            </div>
            <div className="text-[10px] text-[#8bbf9a]">
              {metric.timeframe}
            </div>
          </div>

          <MiniSparkline data={metric.sparkline} color={style.gradientStroke} />
        </div>
      </TiltCard>
    </motion.div>
  );
};

export const KpiGrid: React.FC<{ metrics: KpiMetric[] }> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {metrics.map((metric, idx) => (
        <KpiCard key={metric.id} metric={metric} index={idx} />
      ))}
    </div>
  );
};

export default KpiGrid;
