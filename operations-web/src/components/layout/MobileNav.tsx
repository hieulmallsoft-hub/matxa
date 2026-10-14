import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  LineChart,
  ShoppingBag,
  Users,
  Layers,
  Settings,
  X,
  Cpu,
  Radio,
  Zap,
  UserCheck,
  ClipboardCheck,
  FolderTree,
  BookOpen,
  TicketPercent,
  Bell,
  MessageSquare,
} from 'lucide-react';
import { PageId } from '../../types/dashboard';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
}

const MOBILE_DRAWER_ITEMS: { id: PageId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { id: 'analytics', label: 'Doanh thu & chỉ số', icon: LineChart },
  { id: 'orders', label: 'Lịch đặt & đơn hàng', icon: ShoppingBag },
  { id: 'technicians', label: 'Kỹ thuật viên', icon: UserCheck },
  { id: 'applications', label: 'Duyệt hồ sơ KTV', icon: ClipboardCheck },
  { id: 'catalog', label: 'Catalog dịch vụ', icon: FolderTree },
  { id: 'courses', label: 'Khóa học đào tạo', icon: BookOpen },
  { id: 'promotions', label: 'Khuyến mãi & Banner', icon: TicketPercent },
  { id: 'customers', label: 'Khách hàng', icon: Users },
  { id: 'messages', label: 'Tin nhắn CSKH', icon: MessageSquare },
  { id: 'notifications', label: 'Cảnh báo hệ thống', icon: Bell },
  { id: 'settings', label: 'Cấu hình hệ thống', icon: Settings },
];

export const MobileNav: React.FC<MobileNavProps> = ({
  isOpen,
  onClose,
  currentPage,
  onNavigate,
}) => {
  return (
    <>
      {/* Mobile Drawer */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="mobile-drawer relative w-80 max-w-[88vw] h-full p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-6 border-b border-[#dce9d7]">
                  <div className="flex items-center gap-2.5">
                    <div className="mobile-brand-mark w-9 h-9 rounded-xl flex items-center justify-center">
                      <Cpu className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <span className="font-bold text-sm tracking-wider text-[#173624]">MATXA OPS</span>
                      <div className="text-[10px] text-[#4f8f46] font-mono">WELLNESS OPERATIONS</div>
                    </div>
                  </div>
                  <button onClick={onClose} className="mobile-close-button p-1 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-6 space-y-1.5 overflow-y-auto pr-1">
                  {MOBILE_DRAWER_ITEMS.map((item) => {
                    const isActive = currentPage === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onNavigate(item.id);
                          onClose();
                        }}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                          isActive
                            ? 'mobile-nav-item-active'
                            : 'mobile-nav-item'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mobile-drawer-status pt-4 border-t text-[11px] font-mono">
                <div className="flex items-center gap-2 mb-1">
                  <Radio className="w-3.5 h-3.5 text-[#4f8f46]" />
                  <span>HỆ THỐNG ĐANG HOẠT ĐỘNG</span>
                </div>
                <div className="text-[10px] text-[#78907a]">MATXA OPERATIONS</div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Floating Bottom Bar */}
      <div className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-30 md:hidden px-3 py-2 flex items-center justify-around">
        {[
          { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
          { id: 'orders', label: 'Lịch đặt', icon: ShoppingBag },
          { id: 'technicians', label: 'KTV', icon: UserCheck },
          { id: 'courses', label: 'Khóa học', icon: BookOpen },
          { id: 'settings', label: 'Cài đặt', icon: Settings },
        ].map((tab) => {
          const isActive = currentPage === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id as PageId)}
              className={`flex flex-col items-center gap-1 p-1.5 transition-colors ${
                isActive ? 'mobile-tab-active' : 'mobile-tab'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
};

export default MobileNav;
