import React, { useState } from 'react';
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
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Activity,
  CheckCircle2,
  Flower2,
} from 'lucide-react';
import { PageId } from '../../types/dashboard';

interface SidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  unreadNotifications?: number;
  unreadMessages?: number;
}

interface NavGroup {
  groupTitle: string;
  items: {
    id: PageId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
    badgeTone?: 'primary' | 'warning' | 'info';
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupTitle: 'Vận hành',
    items: [
      { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard },
      { id: 'analytics', label: 'Doanh thu & Báo cáo', icon: LineChart },
      { id: 'orders', label: 'Lịch đặt & Đơn hàng', icon: CalendarDays, badge: '8', badgeTone: 'primary' },
    ],
  },
  {
    groupTitle: 'Quản lý',
    items: [
      { id: 'technicians', label: 'Kỹ thuật viên', icon: UsersRound },
      { id: 'applications', label: 'Duyệt hồ sơ KTV', icon: UserCheck, badge: '3', badgeTone: 'warning' },
      { id: 'catalog', label: 'Dịch vụ', icon: FolderTree },
      { id: 'courses', label: 'Khóa học đào tạo', icon: GraduationCap },
    ],
  },
  {
    groupTitle: 'Khách hàng & Marketing',
    items: [
      { id: 'promotions', label: 'Khuyến mãi & Banner', icon: Sparkles },
      { id: 'customers', label: 'Khách hàng', icon: HeartHandshake },
      { id: 'messages', label: 'Tin nhắn CSKH', icon: MessageCircle, badge: '2', badgeTone: 'info' },
    ],
  },
  {
    groupTitle: 'Hệ thống',
    items: [
      { id: 'notifications', label: 'Thông báo hệ thống', icon: Bell },
      { id: 'settings', label: 'Cấu hình hệ thống', icon: Settings },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  isCollapsed,
  onToggleCollapse,
  unreadNotifications = 0,
  unreadMessages = 0,
}) => {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 76 : 256 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="hidden md:flex flex-col h-screen fixed top-0 left-0 z-40 bg-white border-r border-[#E5EBE5] select-none shadow-[2px_0_12px_rgba(28,43,32,0.03)]"
    >
      {/* Brand Header */}
      <div className="h-[66px] flex items-center justify-between px-4 border-b border-[#E5EBE5]">
        <div
          className="flex items-center gap-3 overflow-hidden cursor-pointer"
          onClick={() => onNavigate('dashboard')}
          title="Về trang Tổng quan MATXXA"
        >
          <div className="w-9 h-9 rounded-xl bg-[#2E7D4A] flex items-center justify-center flex-shrink-0 shadow-sm shadow-[#2E7D4A]/25">
            <Flower2 className="w-5 h-5 text-white" />
          </div>

          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col min-w-0"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-wide text-[#1C2B20]">
                    MATXXA
                  </span>
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#EAF5EC] text-[#2E7D4A] border border-[#D0E7D5]">
                    ADMIN
                  </span>
                </div>
                <span className="text-[11px] text-[#66756B] font-medium tracking-tight">
                  Massage & Spa
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
          className="p-1.5 rounded-lg text-[#94A399] hover:text-[#2E7D4A] hover:bg-[#F6F8F4] transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4 scrollbar-none">
        {NAV_GROUPS.map((group, gIdx) => (
          <div key={gIdx} className="space-y-1">
            {!isCollapsed && (
              <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#94A399]">
                {group.groupTitle}
              </div>
            )}

            {group.items.map((item) => {
              const isActive = currentPage === item.id;
              const Icon = item.icon;

              const badgeValue =
                item.id === 'notifications' && unreadNotifications > 0
                  ? unreadNotifications
                  : item.id === 'messages' && unreadMessages > 0
                  ? unreadMessages
                  : item.badge;

              return (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <button
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 relative group cursor-pointer ${
                      isActive
                        ? 'bg-[#EAF5EC] text-[#1C2B20] font-semibold shadow-xs'
                        : 'text-[#66756B] hover:text-[#1C2B20] hover:bg-[#F6F8F4] hover:translate-x-1'
                    }`}
                  >
                    {/* Active Left Indicator Pill */}
                    {isActive && (
                      <motion.div
                        layoutId="activeSidebarIndicator"
                        className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#2E7D4A]"
                        transition={{ duration: 0.2 }}
                      />
                    )}

                    {/* Icon */}
                    <div
                      className={`flex-shrink-0 transition-colors ${
                        isActive ? 'text-[#2E7D4A]' : 'text-[#94A399] group-hover:text-[#2E7D4A]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Label */}
                    {!isCollapsed && (
                      <span className="flex-1 text-left truncate tracking-tight">
                        {item.label}
                      </span>
                    )}

                    {/* Badge */}
                    {!isCollapsed && badgeValue && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          isActive
                            ? 'bg-[#2E7D4A] text-white'
                            : item.badgeTone === 'warning'
                            ? 'bg-[#FEF6E9] text-[#B87A14] border border-[#FBE3B8]'
                            : item.badgeTone === 'info'
                            ? 'bg-[#EDF4FC] text-[#2970C2] border border-[#CDE0F8]'
                            : 'bg-[#EAF5EC] text-[#2E7D4A] border border-[#D0E7D5]'
                        }`}
                      >
                        {badgeValue}
                      </span>
                    )}
                  </button>

                  {/* Tooltip on Collapsed State */}
                  {isCollapsed && hoveredItem === item.id && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 rounded-lg bg-[#1C2B20] text-white text-xs font-medium shadow-xl border border-white/10 whitespace-nowrap z-50 pointer-events-none">
                      {item.label}
                      {badgeValue && ` (${badgeValue})`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer System Status */}
      <div className="p-3 border-t border-[#E5EBE5] bg-white">
        {!isCollapsed ? (
          <div className="p-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2E9B62] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2E9B62]"></span>
              </span>
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-[#1C2B20]">
                  Hệ thống hoạt động tốt
                </span>
                <span className="text-[10px] text-[#66756B]">Sẵn sàng nhận lịch</span>
              </div>
            </div>
            <ShieldCheck className="w-4 h-4 text-[#2E7D4A]" />
          </div>
        ) : (
          <div className="flex justify-center py-1" title="Hệ thống hoạt động tốt">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2E9B62] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#2E9B62]"></span>
            </span>
          </div>
        )}
      </div>
    </motion.aside>
  );
};

export default Sidebar;
