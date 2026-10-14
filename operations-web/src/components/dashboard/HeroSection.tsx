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
    <div className="relative rounded-3xl bg-gradient-to-b from-[#001910]/95 via-[#082217]/90 to-[#001910]/95 border border-[#385723]/40 p-6 sm:p-8 overflow-hidden backdrop-blur-2xl shadow-2xl shadow-[#001910]/80">
      {/* Ambient background glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#385723]/25 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-10 left-10 w-72 h-72 bg-[#94AB71]/20 rounded-full blur-[90px] pointer-events-none" />

      {/* Grid Pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(rgba(199, 217, 181, 0.6) 1px, transparent 1px)`,
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
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#385723]/30 border border-[#94AB71]/40 text-[#C7D9B5] text-xs font-mono shadow-sm"
          >
            <span className="w-2 h-2 rounded-full bg-[#94AB71] animate-pulse" />
            <span className="text-[#F9EDB2] font-semibold tracking-wide">ORGANIC WELLNESS & SPA OPS CLUSTER</span>
            <span className="text-[#385723]">|</span>
            <span className="text-[#C7D9B5]/80">MATXA HIGH-PERFORMANCE NODE</span>
          </motion.div>

          {/* Heading */}
          <div className="space-y-2">
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#FFFAF5]"
            >
              Chào buổi sáng,{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#FFFAF5] via-[#F9EDB2] to-[#C7D9B5]">
                Quản trị viên
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="text-[#C7D9B5]/90 text-sm sm:text-base max-w-xl leading-relaxed"
            >
              Hệ thống vận hành cơ sở spa và phân phối trị liệu hoạt động ổn định 100%. Toàn bộ lịch hẹn,
              kỹ thuật viên, khóa đào tạo và chỉ số doanh thu sẵn sàng theo dõi thời gian thực.
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
            <div className="flex items-center p-1 rounded-xl bg-[#001910]/80 border border-[#385723]/50 backdrop-blur-md">
              <Calendar className="w-3.5 h-3.5 text-[#94AB71] ml-2 mr-1 hidden sm:block" />
              {DATE_OPTIONS.map((option) => {
                const isActive = dateRange === option;
                return (
                  <button
                    key={option}
                    onClick={() => onSelectDateRange(option)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-[#385723] to-[#4d7530] text-[#FFFAF5] shadow-md shadow-[#385723]/40 border border-[#94AB71]/40'
                        : 'text-[#C7D9B5]/70 hover:text-[#FFFAF5] hover:bg-[#385723]/20'
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
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#385723] via-[#4d7530] to-[#94AB71] text-[#FFFAF5] text-xs font-semibold shadow-lg shadow-[#385723]/30 hover:shadow-[#94AB71]/40 border border-[#F9EDB2]/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#F9EDB2]" />
              <span>+ Báo cáo Mới</span>
            </motion.button>
          </motion.div>

          {/* Micro Telemetry Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="pt-2 flex flex-wrap items-center gap-6 text-xs text-[#C7D9B5]/80 font-mono"
          >
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[#94AB71]" />
              <span>TẢI HỆ THỐNG: 24%</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[#F9EDB2]" />
              <span>BẢO MẬT DỮ LIỆU: AN TOÀN</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#C7D9B5]" />
              <span>ĐỘ CHÍNH XÁC DỰ BÁO: 99.4%</span>
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
          <div className="w-full relative rounded-2xl bg-gradient-to-b from-[#385723]/10 to-transparent border border-[#385723]/40 p-2 overflow-hidden shadow-inner">
            <Hero3DOrb />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default HeroSection;
