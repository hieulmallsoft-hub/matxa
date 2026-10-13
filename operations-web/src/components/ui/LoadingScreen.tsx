import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cpu, ShieldCheck, Activity } from 'lucide-react';

interface LoadingScreenProps {
  onComplete: () => void;
}

const BOOT_LOGS = [
  'Allocating cryptographic telemetry enclave...',
  'Connecting to global low-latency proxy mesh...',
  'Initializing React Three Fiber WebGL canvas...',
  'Synchronizing real-time order ledger v3.4...',
  'Aetheris Neural Control Center ready.',
];

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(12);
  const [logIndex, setLogIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onComplete, 400);
          return 100;
        }
        const jump = Math.floor(Math.random() * 22) + 12;
        const next = Math.min(100, prev + jump);
        return next;
      });
    }, 180);

    const logTimer = setInterval(() => {
      setLogIndex((prev) => (prev < BOOT_LOGS.length - 1 ? prev + 1 : prev));
    }, 280);

    return () => {
      clearInterval(timer);
      clearInterval(logTimer);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#07080D] text-white selection:bg-none"
    >
      {/* Background ambient lighting */}
      <div className="absolute w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute w-[350px] h-[350px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Futuristic Center Emblem */}
      <div className="relative mb-8 flex items-center justify-center">
        {/* Outer rotating pulse ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 12, ease: 'linear' }}
          className="w-24 h-24 rounded-full border border-dashed border-cyan-500/30 flex items-center justify-center"
        />

        {/* Counter-rotating inner ring */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
          className="absolute w-18 h-18 rounded-full border border-indigo-500/40"
        />

        {/* Glowing Core Icon */}
        <div className="absolute w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/30">
          <Cpu className="w-6 h-6 text-white animate-pulse" />
        </div>
      </div>

      {/* Brand title */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center mb-6"
      >
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-xl font-bold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-cyan-300">
            AETHERIS
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            OS 3.4
          </span>
        </div>
        <p className="text-xs text-slate-400 tracking-wide font-mono">
          HIGH-END TECHNOLOGY & INTELLIGENCE CENTER
        </p>
      </motion.div>

      {/* Progress bar container */}
      <div className="w-64 max-w-xs space-y-2.5">
        <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden p-[1px] border border-white/5">
          <motion.div
            className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 rounded-full"
            style={{ width: `${progress}%` }}
            transition={{ ease: 'easeOut', duration: 0.2 }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span className="truncate pr-2 text-cyan-400/90">{BOOT_LOGS[logIndex]}</span>
          <span className="font-semibold text-white">{progress}%</span>
        </div>
      </div>

      {/* Bottom Telemetry Badges */}
      <div className="absolute bottom-8 flex items-center gap-6 text-[11px] font-mono text-slate-500">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> ENCRYPTION: SHA-384
        </span>
        <span className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-cyan-400" /> LATENCY: 14MS
        </span>
      </div>
    </motion.div>
  );
};

export default LoadingScreen;
