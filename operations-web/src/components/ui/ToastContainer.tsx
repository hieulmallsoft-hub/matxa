import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export interface Toast {
  id: string;
  title: string;
  message?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Errors stay long enough to read the API detail; successes get out of the way.
const DURATION_MS = { success: 3500, info: 4000, warning: 6000, error: 8000 } as const;
const MAX_VISIBLE = 4;

const typeConfig = {
  success: { accent: 'bg-status-success', icon: <CheckCircle2 className="w-5 h-5 text-status-success" /> },
  error: { accent: 'bg-status-danger', icon: <AlertCircle className="w-5 h-5 text-status-danger" /> },
  warning: { accent: 'bg-status-warning', icon: <AlertTriangle className="w-5 h-5 text-status-warning" /> },
  info: { accent: 'bg-status-info', icon: <Info className="w-5 h-5 text-status-info" /> },
};

function ToastCard({ toast, onClose }: { toast: Required<Pick<Toast, 'type'>> & Toast; onClose: () => void }) {
  const total = DURATION_MS[toast.type];
  const [paused, setPaused] = useState(false);
  const remaining = useRef<number>(total);
  const startedAt = useRef(Date.now());
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => closeRef.current(), remaining.current);
    return () => window.clearTimeout(timer);
  }, [paused]);
  const pause = () => {
    remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    setPaused(true);
  };
  const resume = () => {
    startedAt.current = Date.now();
    setPaused(false);
  };
  const left = `${(remaining.current / total) * 100}%`;
  const config = typeConfig[toast.type];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', damping: 26, stiffness: 360 }}
      onMouseEnter={pause}
      onMouseLeave={resume}
      role={toast.type === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto relative overflow-hidden rounded-2xl bg-white border border-surface-border shadow-[0_12px_32px_rgba(28,43,32,0.14)] p-4 pr-10 flex items-start gap-3"
    >
      <div className="mt-0.5 shrink-0">{config.icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-content-primary">{toast.title}</p>
        {toast.message && <p className="text-xs text-content-secondary mt-0.5 leading-relaxed break-words">{toast.message}</p>}
      </div>
      <button onClick={onClose} aria-label="Đóng thông báo" className="absolute top-3 right-3 p-1 rounded-md text-content-tertiary hover:text-content-primary hover:bg-surface-subtle">
        <X className="w-4 h-4" />
      </button>
      {/* Countdown bar; freezes while hovered. */}
      {paused ? (
        <div className={`absolute left-0 bottom-0 h-[3px] ${config.accent}`} style={{ width: left }} />
      ) : (
        <motion.div
          key={startedAt.current}
          className={`absolute left-0 bottom-0 h-[3px] ${config.accent}`}
          initial={{ width: left }}
          animate={{ width: '0%' }}
          transition={{ duration: remaining.current / 1000, ease: 'linear' }}
        />
      )}
    </motion.div>
  );
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Array<Required<Pick<Toast, 'type'>> & Toast>>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(({ title, message, type = 'info' }: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => {
      // The same message twice in a row (e.g. a retried request) is shown once.
      const withoutDuplicate = prev.filter((toast) => !(toast.title === title && toast.message === message));
      return [...withoutDuplicate, { id, title, message, type }].slice(-MAX_VISIBLE);
    });
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed top-4 right-4 left-4 sm:left-auto z-[90] flex flex-col gap-2.5 sm:w-[380px] pointer-events-none" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <ToastCard key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

export default ToastProvider;
