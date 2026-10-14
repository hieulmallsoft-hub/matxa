import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  ShoppingBag,
  Layers,
  UserPlus,
  FileText,
  Sparkles,
  X,
} from 'lucide-react';

interface QuickActionsFloatingProps {
  onTriggerAction: (actionName: string) => void;
}

interface ActionButton {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgGradient: string;
  delay: number;
  offsetY: number;
}

const ACTIONS: ActionButton[] = [
  {
    id: 'create-order',
    label: 'Tạo Lịch / Đơn Mới',
    icon: ShoppingBag,
    color: 'text-[#F9EDB2]',
    bgGradient: 'from-[#385723] to-[#4d7530]',
    delay: 0.05,
    offsetY: -70,
  },
  {
    id: 'add-product',
    label: 'Thêm Gói Trị Liệu',
    icon: Layers,
    color: 'text-[#FFFAF5]',
    bgGradient: 'from-[#94AB71] to-[#385723]',
    delay: 0.1,
    offsetY: -130,
  },
  {
    id: 'add-customer',
    label: 'Đăng Ký Hội Viên',
    icon: UserPlus,
    color: 'text-[#C7D9B5]',
    bgGradient: 'from-[#2d481c] to-[#94AB71]',
    delay: 0.15,
    offsetY: -190,
  },
  {
    id: 'new-report',
    label: 'Xuất Báo Cáo Doanh Thu',
    icon: FileText,
    color: 'text-[#F9EDB2]',
    bgGradient: 'from-[#4d7530] to-[#203613]',
    delay: 0.2,
    offsetY: -250,
  },
];

export const QuickActionsFloating: React.FC<QuickActionsFloatingProps> = ({
  onTriggerAction,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {/* Action Items List */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop click away */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
            />

            {/* Floating Action Buttons */}
            <div className="relative z-40">
              {ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <motion.div
                    key={action.id}
                    initial={{ opacity: 0, y: 0, scale: 0.4 }}
                    animate={{ opacity: 1, y: action.offsetY, scale: 1 }}
                    exit={{ opacity: 0, y: 0, scale: 0.4 }}
                    transition={{
                      type: 'spring',
                      damping: 18,
                      stiffness: 300,
                      delay: action.delay,
                    }}
                    className="absolute bottom-0 right-0 flex items-center gap-3 whitespace-nowrap"
                  >
                    {/* Tooltip Label */}
                    <div className="px-3 py-1.5 rounded-xl bg-[#001910]/95 border border-[#385723]/60 backdrop-blur-md text-[#FFFAF5] text-xs font-medium shadow-2xl">
                      {action.label}
                    </div>

                    {/* Action Icon Button */}
                    <motion.button
                      whileHover={{ scale: 1.12 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => {
                        onTriggerAction(action.id);
                        setIsOpen(false);
                      }}
                      className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${action.bgGradient} flex items-center justify-center text-[#FFFAF5] shadow-xl shadow-[#001910]/80 border border-[#F9EDB2]/30`}
                    >
                      <Icon className="w-5 h-5" />
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Main Trigger Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setIsOpen(!isOpen)}
        className="relative z-40 w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#385723] via-[#4d7530] to-[#94AB71] flex items-center justify-center text-[#FFFAF5] shadow-2xl shadow-[#001910]/80 border border-[#F9EDB2]/40 cursor-pointer"
        title="Tác vụ nhanh"
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </motion.div>

        {/* Ambient Ring Glow */}
        <span className="absolute -inset-1 rounded-2xl bg-cyan-400/20 blur-md -z-10 animate-pulse pointer-events-none" />
      </motion.button>
    </div>
  );
};

export default QuickActionsFloating;
