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
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-cyan-400' },
  { id: 'analytics', label: 'Analytics', icon: LineChart, color: 'text-violet-400' },
  { id: 'orders', label: 'Orders', icon: ShoppingBag, badge: '7', color: 'text-blue-400' },
  { id: 'customers', label: 'Customers', icon: Users, color: 'text-emerald-400' },
  { id: 'products', label: 'Products', icon: Layers, color: 'text-amber-400' },
  { id: 'payments', label: 'Payments', icon: CreditCard, color: 'text-indigo-400' },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight, color: 'text-teal-400' },
  { id: 'messages', label: 'Messages', icon: MessageSquare, badge: 3, color: 'text-sky-400' },
  { id: 'notifications', label: 'Notifications', icon: Bell, badge: 2, color: 'text-rose-400' },
  { id: 'settings', label: 'Settings', icon: Settings, color: 'text-slate-400' },
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
      className="hidden md:flex flex-col h-screen fixed top-0 left-0 z-40 bg-[#080A12]/90 backdrop-blur-2xl border-r border-white/5 select-none"
    >
      {/* Brand Header */}
      <div className="h-18 flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-3 overflow-hidden cursor-pointer" onClick={() => onNavigate('dashboard')}>
          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-600/30">
            <Cpu className="w-5 h-5 text-white" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-[#080A12]" />
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
                  <span className="font-bold text-base tracking-wider text-white">AETHERIS</span>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-indigo-500/20 text-cyan-300 border border-cyan-500/30">
                    PRO
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono tracking-wider">
                  INTELLIGENCE OS
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
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
                    ? 'text-white bg-gradient-to-r from-indigo-500/20 via-indigo-500/10 to-transparent border border-indigo-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-cyan-400 shadow-sm shadow-cyan-400"
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  />
                )}

                {/* Icon with micro animation */}
                <motion.div
                  whileHover={{ scale: 1.12, rotate: 2 }}
                  transition={{ type: 'spring', stiffness: 400 }}
                  className={`flex-shrink-0 ${isActive ? item.color : 'text-slate-400 group-hover:text-white'}`}
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
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-indigo-500/20 text-cyan-300 border border-indigo-500/30">
                    {item.badge}
                  </span>
                )}
              </button>

              {/* Tooltip on Collapsed State */}
              {isCollapsed && hoveredItem === item.id && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-medium shadow-xl border border-white/10 whitespace-nowrap z-50 pointer-events-none">
                  {item.label}
                  {item.badge && ` (${item.badge})`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer System Telemetry Widget */}
      <div className="p-3 border-t border-white/5">
        {!isCollapsed ? (
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> Global Telemetry
              </span>
              <span className="font-mono text-[11px] text-cyan-400">99.98%</span>
            </div>

            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 w-[94%]" />
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>LATENCY: 18MS</span>
              <span className="text-emerald-400 flex items-center gap-1">
                <Zap className="w-3 h-3" /> ONLINE
              </span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-2" title="System Operational • 18ms">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
        )}
      </div>
    </motion.aside>
  );
};

export default Sidebar;
