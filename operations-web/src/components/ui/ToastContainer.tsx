import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

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

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback(({ title, message, type = 'info' }: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const typeConfig = {
    success: {
      border: 'border-[#C8EED7]',
      bg: 'bg-white',
      accent: 'bg-[#2E9B62]',
      icon: <CheckCircle2 className="w-5 h-5 text-[#2E9B62]" />,
    },
    error: {
      border: 'border-[#F8D2D0]',
      bg: 'bg-white',
      accent: 'bg-[#E05B55]',
      icon: <AlertCircle className="w-5 h-5 text-[#E05B55]" />,
    },
    warning: {
      border: 'border-[#FBE3B8]',
      bg: 'bg-white',
      accent: 'bg-[#F2A93B]',
      icon: <AlertTriangle className="w-5 h-5 text-[#F2A93B]" />,
    },
    info: {
      border: 'border-[#CDE0F8]',
      bg: 'bg-white',
      accent: 'bg-[#4285D4]',
      icon: <Info className="w-5 h-5 text-[#4285D4]" />,
    },
  };

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Top right notification stack */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => {
            const config = typeConfig[toast.type || 'info'];
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 25, scale: 0.9 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className={`pointer-events-auto p-4 rounded-xl ${config.bg} border ${config.border} shadow-[0_8px_24px_rgba(28,43,32,0.10)] flex items-start gap-3 relative overflow-hidden group`}
              >
                {/* Left vertical accent line */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.accent}`} />

                <div className="mt-0.5 flex-shrink-0">{config.icon}</div>

                <div className="flex-1 min-w-0 pr-3">
                  <div className="text-sm font-bold text-[#1C2B20]">{toast.title}</div>
                  {toast.message && (
                    <div className="text-xs text-[#66756B] mt-0.5 leading-relaxed">
                      {toast.message}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => removeToast(toast.id)}
                  className="text-[#94A399] hover:text-[#1C2B20] transition-colors p-0.5 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export default ToastProvider;
