import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Calendar, Sparkles, Activity, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { Hero3DOrb } from '../three/Hero3DOrb';

interface HeroSectionProps {
  dateRange: string;
  onSelectDateRange: (range: string) => void;
  onOpenNewReport: () => void;
  onQuickExplore?: () => void;
}

const DATE_OPTIONS = [
  'Today',
  'Last 7 Days',
  'Last 30 Days',
  'Q3 2026',
  'Custom',
];

export const HeroSection: React.FC<HeroSectionProps> = ({
  dateRange,
  onSelectDateRange,
  onOpenNewReport,
  onQuickExplore,
}) => {
  return (
    <div className="relative rounded-3xl bg-gradient-to-b from-[#0F1424]/90 via-[#0C0F1A]/80 to-[#080A12]/90 border border-white/10 p-6 sm:p-8 overflow-hidden backdrop-blur-2xl shadow-2xl shadow-indigo-950/20">
      {/* Ambient background glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-10 left-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Grid Pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Greeting, subtitle, date selector, actions */}
        <div className="lg:col-span-7 space-y-6">
          {/* Status Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-mono"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>FINTECH & AUTONOMOUS SAAS CLUSTER</span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">US-EAST HIGH SPEED</span>
          </motion.div>

          {/* Heading */}
          <div className="space-y-2">
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white"
            >
              Good morning,{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-indigo-300 to-violet-400">
                Alex
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="text-slate-300 text-sm sm:text-base max-w-xl leading-relaxed"
            >
              Here’s what’s happening with your business today. All core payment systems,
              fulfillment nodes, and predictive telemetry pipelines are operating at 100% capacity.
            </motion.p>
          </div>

          {/* Controls: Date Range & Primary CTA */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-wrap items-center gap-3 pt-2"
          >
            {/* Date Range Selector Pill Tabs */}
            <div className="flex items-center p-1 rounded-xl bg-black/40 border border-white/10 backdrop-blur-md">
              <Calendar className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1 hidden sm:block" />
              {DATE_OPTIONS.map((option) => {
                const isActive = dateRange === option;
                return (
                  <button
                    key={option}
                    onClick={() => onSelectDateRange(option)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            {/* Primary CTA Button */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={onOpenNewReport}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-violet-600 text-white text-xs font-semibold shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 border border-white/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ New Report</span>
            </motion.button>
          </motion.div>

          {/* Micro Telemetry Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="pt-2 flex flex-wrap items-center gap-6 text-xs text-slate-400 font-mono"
          >
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>SYSTEM LOAD: 24%</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>PCI-DSS ENCLAVE: SECURE</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              <span>PREDICTIVE ACCURACY: 99.4%</span>
            </div>
          </motion.div>
        </div>

        {/* Right Column: 3D Abstract Object */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="lg:col-span-5 relative flex items-center justify-center"
        >
          <div className="w-full relative rounded-2xl bg-gradient-to-b from-white/[0.04] to-transparent border border-white/10 p-2 overflow-hidden shadow-inner">
            <Hero3DOrb />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default HeroSection;
