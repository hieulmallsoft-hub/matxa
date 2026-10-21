import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, CheckCircle2 } from 'lucide-react';

interface LoadingScreenProps {
  onComplete: () => void;
}

const BOOT_LOGS = [
  'Đang khởi tạo hệ thống quản trị MATXXA...',
  'Kết nối máy chủ điều phối ca massage...',
  'Đồng bộ dữ liệu kỹ thuật viên & khách hàng...',
  'Tải bảng điều khiển vận hành Spa...',
  'Hệ thống MATXXA đã sẵn sàng.',
];

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(15);
  const [logIndex, setLogIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onComplete, 300);
          return 100;
        }
        const jump = Math.floor(Math.random() * 20) + 15;
        const next = Math.min(100, prev + jump);
        return next;
      });
    }, 150);

    const logTimer = setInterval(() => {
      setLogIndex((prev) => (prev < BOOT_LOGS.length - 1 ? prev + 1 : prev));
    }, 220);

    return () => {
      clearInterval(timer);
      clearInterval(logTimer);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F6F8F4] text-[#1C2B20]"
    >
      {/* Brand Emblem */}
      <div className="relative mb-6 flex items-center justify-center">
        <div className="w-16 h-16 rounded-2xl bg-[#EAF5EC] border border-[#2E7D4A]/20 flex items-center justify-center shadow-sm">
          <Sparkles className="w-8 h-8 text-[#2E7D4A] animate-pulse" />
        </div>
      </div>

      {/* Brand title */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-6"
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-2xl font-bold tracking-tight text-[#1C2B20]">
            MATXXA
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#EAF5EC] text-[#2E7D4A] border border-[#2E7D4A]/20">
            Admin Spa
          </span>
        </div>
        <p className="text-xs text-[#66756B]">
          HỆ THỐNG QUẢN TRỊ MASSAGE & SPA TẠI NHÀ
        </p>
      </motion.div>

      {/* Progress bar container */}
      <div className="w-64 max-w-xs space-y-2">
        <div className="w-full h-2 bg-[#E5EBE5] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#2E7D4A] rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-[#66756B]">
          <span className="truncate pr-2">{BOOT_LOGS[logIndex]}</span>
          <span className="font-semibold text-[#2E7D4A]">{progress}%</span>
        </div>
      </div>
    </motion.div>
  );
};
