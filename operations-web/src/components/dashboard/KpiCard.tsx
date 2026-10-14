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
    bgGlow: 'rgba(56, 87, 35, 0.25)',
    iconBg: 'bg-[#385723]/30 text-[#F9EDB2] border-[#385723]/60',
    gradientStroke: '#385723',
  },
  cyan: {
    bgGlow: 'rgba(148, 171, 113, 0.25)',
    iconBg: 'bg-[#94AB71]/25 text-[#FFFAF5] border-[#94AB71]/60',
    gradientStroke: '#94AB71',
  },
  violet: {
    bgGlow: 'rgba(249, 237, 178, 0.25)',
    iconBg: 'bg-[#F9EDB2]/20 text-[#F9EDB2] border-[#F9EDB2]/40',
    gradientStroke: '#F9EDB2',
  },
  emerald: {
    bgGlow: 'rgba(199, 217, 181, 0.25)',
    iconBg: 'bg-[#C7D9B5]/25 text-[#FFFAF5] border-[#C7D9B5]/60',
    gradientStroke: '#C7D9B5',
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
        className="p-5 sm:p-6 bg-[#001910]/90 backdrop-blur-xl border border-[#385723]/40 hover:border-[#94AB71]/60 transition-all rounded-2xl shadow-lg"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${style.iconBg}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#C7D9B5]/80 tracking-wide uppercase">
                {metric.title}
              </span>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#FFFAF5] mt-0.5">
                {displayValue}
              </div>
            </div>
          </div>

          {/* Percentage badge */}
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-medium ${
              metric.isPositive
                ? 'bg-[#385723]/40 text-[#C7D9B5] border border-[#94AB71]/40'
                : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
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
        <div className="pt-2 border-t border-[#385723]/30 flex items-end justify-between">
          <div className="space-y-0.5">
            <div className="text-[11px] text-[#C7D9B5]/80 font-mono">
              {metric.comparisonText}
            </div>
            <div className="text-[10px] text-[#94AB71]/80">
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
