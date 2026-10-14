import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  LineChart,
  ShoppingBag,
  Users,
  Layers,
  CreditCard,
  ArrowLeftRight,
  MessageSquare,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Radio,
  Zap,
  UserCheck,
  ClipboardCheck,
  FolderTree,
  BookOpen,
  TicketPercent,
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

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  color: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Tổng quan 3D', icon: LayoutDashboard, color: 'text-[#C7D9B5]' },
  { id: 'analytics', label: 'Doanh thu & Metric', icon: LineChart, color: 'text-[#F9EDB2]' },
  { id: 'orders', label: 'Lịch đặt & Đơn hàng', icon: ShoppingBag, badge: '8', color: 'text-[#94AB71]' },
  { id: 'technicians', label: 'Kỹ thuật viên', icon: UserCheck, color: 'text-[#C7D9B5]' },
  { id: 'applications', label: 'Duyệt hồ sơ KTV', icon: ClipboardCheck, badge: '3', color: 'text-[#F9EDB2]' },
  { id: 'catalog', label: 'Catalog dịch vụ', icon: FolderTree, color: 'text-[#94AB71]' },
  { id: 'courses', label: 'Khóa học đào tạo', icon: BookOpen, color: 'text-[#C7D9B5]' },
  { id: 'promotions', label: 'Khuyến mãi & Banner', icon: TicketPercent, color: 'text-[#F9EDB2]' },
  { id: 'customers', label: 'Khách hàng', icon: Users, color: 'text-[#94AB71]' },
  { id: 'messages', label: 'Tin nhắn CSKH', icon: MessageSquare, badge: 3, color: 'text-[#C7D9B5]' },
  { id: 'notifications', label: 'Cảnh báo hệ thống', icon: Bell, badge: 2, color: 'text-[#F9EDB2]' },
  { id: 'settings', label: 'Cấu hình hệ thống', icon: Settings, color: 'text-[#94AB71]' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 80 : 260 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="hidden md:flex flex-col h-screen fixed top-0 left-0 z-40 bg-[#001910]/95 backdrop-blur-2xl border-r border-[#C7D9B5]/12 select-none"
    >
      {/* Brand Header */}
      <div className="h-18 flex items-center justify-between px-5 py-4 border-b border-[#C7D9B5]/10">
        <div className="flex items-center gap-3 overflow-hidden cursor-pointer" onClick={() => onNavigate('dashboard')}>
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-[#385723] via-[#4d7530] to-[#C7D9B5] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#385723]/30">
            <Cpu className="w-5 h-5 text-[#FFFAF5]" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#F9EDB2] ring-2 ring-[#001910]" />
          </div>

          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col min-w-0"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-base tracking-wider text-[#FFFAF5]">MATXA OPS</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-[#385723]/40 text-[#F9EDB2] border border-[#94AB71]/35">
                    PRO 3.4
                  </span>
                </div>
                <span className="text-[10px] text-[#8A9E7A] font-mono tracking-wider">
                  WELLNESS TELEMETRY OS
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded-lg text-[#8A9E7A] hover:text-[#FFFAF5] hover:bg-white/5 transition-colors"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5 scrollbar-none">
        {NAV_ITEMS.map((item) => {
          const isActive = currentPage === item.id;
          const Icon = item.icon;

          return (
            <div
              key={item.id}
              className="relative"
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <button
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative ${
                  isActive
                    ? 'text-[#FFFAF5] bg-gradient-to-r from-[#385723]/40 via-[#385723]/20 to-transparent border border-[#94AB71]/40 shadow-sm shadow-[#385723]/20'
                    : 'text-[#C7D9B5]/75 hover:text-[#FFFAF5] hover:bg-white/5'
                }`}
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#C7D9B5] shadow-sm shadow-[#C7D9B5]"
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  />
                )}

                {/* Icon with micro animation */}
                <motion.div
                  whileHover={{ scale: 1.12, rotate: 2 }}
                  transition={{ type: 'spring', stiffness: 400 }}
                  className={`flex-shrink-0 ${isActive ? item.color : 'text-[#8A9E7A] group-hover:text-[#FFFAF5]'}`}
                >
                  <Icon className="w-5 h-5" />
                </motion.div>

                {/* Label */}
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 text-left truncate"
                  >
                    {item.label}
                  </motion.span>
                )}

                {/* Badge */}
                {!isCollapsed && item.badge && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#385723]/35 text-[#F9EDB2] border border-[#94AB71]/35">
                    {item.badge}
                  </span>
                )}
              </button>

              {/* Tooltip on Collapsed State */}
              {isCollapsed && hoveredItem === item.id && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 rounded-lg bg-[#062016] text-[#FFFAF5] text-xs font-medium shadow-xl border border-[#C7D9B5]/20 whitespace-nowrap z-50 pointer-events-none">
                  {item.label}
                  {item.badge && ` (${item.badge})`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer System Telemetry Widget */}
      <div className="p-3 border-t border-[#C7D9B5]/10">
        {!isCollapsed ? (
          <div className="p-3 rounded-xl bg-white/[0.03] border border-[#C7D9B5]/10">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="flex items-center gap-1.5 text-[#C7D9B5] font-medium">
                <Radio className="w-3.5 h-3.5 text-[#94AB71] animate-pulse" /> Wellness Telemetry
              </span>
              <span className="font-mono text-[11px] text-[#F9EDB2]">99.98%</span>
            </div>

            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-gradient-to-r from-[#385723] to-[#C7D9B5] w-[94%]" />
            </div>

            <div className="flex items-center justify-between text-[10px] text-[#8A9E7A] font-mono">
              <span>LATENCY: 18MS</span>
              <span className="text-[#94AB71] flex items-center gap-1">
                <Zap className="w-3 h-3" /> ONLINE
              </span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-2" title="System Operational • 18ms">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#94AB71] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#385723]"></span>
            </span>
          </div>
        )}
      </div>
    </motion.aside>
  );
};

export default Sidebar;
