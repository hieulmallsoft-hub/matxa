import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  LineChart,
  CalendarDays,
  UsersRound,
  UserCheck,
  FolderTree,
  GraduationCap,
  Sparkles,
  HeartHandshake,
  MessageCircle,
  Bell,
  Settings,
  X,
  Flower2,
} from 'lucide-react';
import { PageId } from '../../types/dashboard';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

const MOBILE_ITEMS: { id: PageId; label: string; icon: React.ComponentType<{ className?: string }>; group: string }[] = [
  { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, group: 'Vận hành' },
  { id: 'analytics', label: 'Doanh thu & Báo cáo', icon: LineChart, group: 'Vận hành' },
  { id: 'orders', label: 'Lịch đặt & Đơn hàng', icon: CalendarDays, group: 'Vận hành' },
  { id: 'technicians', label: 'Kỹ thuật viên', icon: UsersRound, group: 'Quản lý' },
  { id: 'applications', label: 'Duyệt hồ sơ KTV', icon: UserCheck, group: 'Quản lý' },
  { id: 'catalog', label: 'Dịch vụ', icon: FolderTree, group: 'Quản lý' },
  { id: 'courses', label: 'Khóa học đào tạo', icon: GraduationCap, group: 'Quản lý' },
  { id: 'promotions', label: 'Khuyến mãi & Banner', icon: Sparkles, group: 'Marketing' },
  { id: 'customers', label: 'Khách hàng', icon: HeartHandshake, group: 'Khách hàng' },
  { id: 'messages', label: 'Tin nhắn CSKH', icon: MessageCircle, group: 'Chăm sóc' },
  { id: 'notifications', label: 'Thông báo hệ thống', icon: Bell, group: 'Hệ thống' },
  { id: 'settings', label: 'Cấu hình hệ thống', icon: Settings, group: 'Hệ thống' },
];

export const MobileNav: React.FC<MobileNavProps> = ({
  isOpen,
  onClose,
  currentPage,
  onNavigate,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#1C2B20]/50 backdrop-blur-sm"
          />

          {/* Drawer Content */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="relative w-80 max-w-[85vw] h-full bg-white shadow-2xl flex flex-col justify-between p-5"
          >
            <div>
              <div className="flex items-center justify-between pb-5 border-b border-[#E5EBE5]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#2E7D4A] flex items-center justify-center text-white shadow-sm">
                    <Flower2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-base tracking-wide text-[#1C2B20]">
                      MATXXA
                    </span>
                    <div className="text-[11px] text-[#66756B] font-medium">
                      Massage & Spa Admin
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-[#66756B] hover:text-[#1C2B20] hover:bg-[#F6F8F4]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-5 space-y-1 overflow-y-auto max-h-[calc(100vh-170px)] pr-1">
                {MOBILE_ITEMS.map((item) => {
                  const isActive = currentPage === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id);
                        onClose();
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-[#EAF5EC] text-[#2E7D4A]'
                          : 'text-[#66756B] hover:text-[#1C2B20] hover:bg-[#F6F8F4]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-[#E5EBE5] text-[11px] text-[#66756B] text-center">
              MATXXA Operations • Phiên bản 3.4
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default MobileNav;
