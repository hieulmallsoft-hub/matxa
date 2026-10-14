import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Calendar, Sparkles, Activity, ShieldCheck, HeartHandshake } from 'lucide-react';

interface HeroSectionProps {
  dateRange: string;
  onSelectDateRange: (range: string) => void;
  onOpenNewReport: () => void;
  onQuickExplore?: () => void;
}

const DATE_OPTIONS = ['Today', 'Last 7 Days', 'Last 30 Days', 'Q3 2026', 'Custom'];

export const HeroSection: React.FC<HeroSectionProps> = ({
  dateRange,
  onSelectDateRange,
  onOpenNewReport,
}) => {
  return (
    <div className="relative rounded-3xl overflow-hidden shadow-xl"
      style={{
        background: 'linear-gradient(115deg, #163c25 0%, #23653a 52%, #4a9a53 100%)',
        border: '1px solid rgba(224, 241, 205, 0.28)',
      }}
    >
      {/* Ambient glows */}
      <div className="absolute top-0 right-1/4 w-72 h-72 rounded-full blur-[90px] pointer-events-none"
        style={{ background: 'rgba(74,214,122,0.22)' }} />
      <div className="absolute -bottom-10 left-10 w-56 h-56 rounded-full blur-[80px] pointer-events-none"
        style={{ background: 'rgba(255,255,255,0.10)' }} />

      {/* Dot grid */}
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center p-6 sm:p-8">
        {/* Left */}
        <div className="lg:col-span-7 space-y-6">
          {/* Status Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold"
            style={{
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.32)',
              color: '#fff',
              backdropFilter: 'blur(8px)',
            }}
          >
            <span className="w-2 h-2 rounded-full bg-[#a8f0be] animate-pulse" />
            <span className="tracking-wide">🌿 MATXA SPA OPERATIONS</span>
            <span className="opacity-50">|</span>
            <span className="opacity-80">Hệ thống vận hành</span>
          </motion.div>

          {/* Heading */}
          <div className="space-y-2">
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white"
              style={{ fontFamily: 'Quicksand, Nunito, sans-serif', textShadow: '0 2px 20px rgba(0,0,0,0.20)' }}
            >
              Chào buổi sáng,{' '}
              <span style={{
                background: 'linear-gradient(90deg, #ffffff 0%, #d4f7e0 50%, #a8f0be 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Quản trị viên
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="text-sm sm:text-base max-w-xl leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.82)' }}
            >
              Hệ thống vận hành cơ sở spa và phân phối trị liệu hoạt động ổn định 100%.
              Toàn bộ lịch hẹn, kỹ thuật viên và chỉ số doanh thu sẵn sàng theo dõi thời gian thực.
            </motion.p>
          </div>

          {/* Date Range */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-wrap items-center gap-3 pt-2"
          >
            <div className="flex items-center p-1 rounded-xl"
              style={{
                background: 'rgba(0,0,0,0.20)',
                border: '1px solid rgba(255,255,255,0.18)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <Calendar className="w-3.5 h-3.5 text-white/70 ml-2 mr-1 hidden sm:block" />
              {DATE_OPTIONS.map((option) => {
                const isActive = dateRange === option;
                return (
                  <button
                    key={option}
                    onClick={() => onSelectDateRange(option)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'text-[#0d4a1f] shadow-md'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                    style={isActive ? {
                      background: 'linear-gradient(135deg, #ffffff 0%, #d4f7e0 100%)',
                    } : {}}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            {/* New Report CTA */}
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={onOpenNewReport}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.92)',
                color: '#156b2e',
                border: '1px solid rgba(255,255,255,0.6)',
                boxShadow: '0 6px 22px rgba(0,0,0,0.18)',
              }}
            >
              <Plus className="w-4 h-4" />
              <span>+ Báo cáo Mới</span>
            </motion.button>
          </motion.div>

          {/* Stats Row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.28 }}
            className="pt-2 flex flex-wrap items-center gap-6 text-xs font-semibold"
            style={{ color: 'rgba(255,255,255,0.80)' }}
          >
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[#a8f0be]" />
              <span>TẢI HỆ THỐNG: 24%</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[#a8f0be]" />
              <span>BẢO MẬT: AN TOÀN</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#a8f0be]" />
              <span>DỰ BÁO: 99.4%</span>
            </div>
          </motion.div>
        </div>

        {/* Right: service photography from the wellness collection */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="lg:col-span-5 relative"
        >
          <div className="relative min-h-[268px] sm:min-h-[300px] overflow-hidden rounded-2xl border border-white/30 bg-[#173c25] shadow-[0_18px_42px_rgba(8,45,20,0.24)]">
            <img
              src="/wellness/massage-treatment.jpg"
              alt="Kỹ thuật viên chăm sóc trị liệu cho khách hàng"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#102e1d]/80 via-[#102e1d]/8 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
              <div className="rounded-xl border border-white/30 bg-[#153f25]/75 px-3 py-2.5 text-white backdrop-blur-md">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[.14em] text-[#d7efc4]">
                  <HeartHandshake className="h-3.5 w-3.5" /> Chăm sóc tại nhà
                </div>
                <p className="mt-1 text-sm font-semibold">Trải nghiệm thư giãn, an tâm</p>
              </div>
              <img
                src="/wellness/head-massage.jpg"
                alt="Liệu trình massage chuyên sâu"
                className="h-16 w-16 rounded-xl border-2 border-white/70 object-cover shadow-lg sm:h-20 sm:w-20"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default HeroSection;
