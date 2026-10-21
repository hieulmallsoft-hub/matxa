import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, AlertCircle, HelpCircle, X } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  tone = 'danger',
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const toneConfig = {
    danger: {
      icon: <AlertCircle className="w-6 h-6 text-[#E05B55]" />,
      iconBg: 'bg-[#FDF0EF]',
      btnBg: 'bg-[#E05B55] hover:bg-[#D04A44] text-white shadow-[#E05B55]/20',
    },
    warning: {
      icon: <AlertTriangle className="w-6 h-6 text-[#F2A93B]" />,
      iconBg: 'bg-[#FEF6E9]',
      btnBg: 'bg-[#F2A93B] hover:bg-[#E0982A] text-white shadow-[#F2A93B]/20',
    },
    primary: {
      icon: <HelpCircle className="w-6 h-6 text-[#2E7D4A]" />,
      iconBg: 'bg-[#EAF5EC]',
      btnBg: 'bg-[#2E7D4A] hover:bg-[#256A3E] text-white shadow-[#2E7D4A]/20',
    },
  };

  const current = toneConfig[tone];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#1C2B20]/45 backdrop-blur-sm"
        />

        {/* Modal card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative w-full max-w-md bg-white rounded-2xl border border-[#E5EBE5] shadow-2xl p-6 z-10 space-y-4"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-[#66756B] hover:text-[#1C2B20] rounded-lg hover:bg-[#F6F8F4] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl ${current.iconBg} flex items-center justify-center flex-shrink-0`}
            >
              {current.icon}
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1C2B20] tracking-tight">{title}</h3>
              <p className="text-xs text-[#66756B] mt-1 leading-relaxed">{message}</p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl border border-[#E5EBE5] text-xs font-semibold text-[#66756B] hover:text-[#1C2B20] hover:bg-[#F6F8F4] transition-all"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition-all flex items-center gap-2 cursor-pointer ${current.btnBg}`}
            >
              {isLoading && (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <span>{confirmText}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ConfirmDialog;
