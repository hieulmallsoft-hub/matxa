import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Bell,
  MessageSquare,
  Sparkles,
  ChevronDown,
  User,
  Key,
  Users,
  Shield,
  LogOut,
  Menu,
  Check,
  Moon,
  Palette,
  Sun,
  Laptop,
} from 'lucide-react';
import { PageId, NotificationItem } from '../../types/dashboard';

interface NavbarProps {
  currentPage: PageId;
  onOpenCommandPalette: () => void;
  onNavigate: (page: PageId) => void;
  onOpenMobileMenu?: () => void;
  notifications: NotificationItem[];
  onMarkNotificationsRead: () => void;
  theme: string;
  onToggleTheme: (t: string) => void;
}

const PAGE_NAMES: Record<PageId, string> = {
  dashboard: 'Overview & Telemetry',
  analytics: 'Revenue & Cohort Analytics',
  orders: 'Orders Management',
  customers: 'Customer Directory',
  products: 'Products & Inventory',
  payments: 'Payment Gateways',
  transactions: 'Real-Time Ledger',
  messages: 'In-App Messages',
  notifications: 'Notifications & Alerts',
  settings: 'System Preferences',
};

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onOpenCommandPalette,
  onNavigate,
  onOpenMobileMenu,
  notifications,
  onMarkNotificationsRead,
  theme,
  onToggleTheme,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setShowThemeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 w-full h-18 bg-[#080A12]/80 backdrop-blur-xl border-b border-white/5 px-4 sm:px-6 flex items-center justify-between">
      {/* Left: Mobile hamburger & Breadcrumb */}
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-500 hover:text-slate-300 cursor-pointer" onClick={() => onNavigate('dashboard')}>
            AETHERIS
          </span>
          <span className="text-slate-700">/</span>
          <span className="text-cyan-400 font-medium tracking-wide">
            {PAGE_NAMES[currentPage] || currentPage.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Middle: Global Search Bar */}
      <div className="flex-1 max-w-md mx-4 hidden lg:block">
        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/10 text-xs text-slate-400 hover:text-slate-200 transition-all group"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
            <span>Search telemetry, orders, customers...</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-[10px] bg-black/40 px-2 py-0.5 rounded border border-white/10 text-slate-400">
            <span>⌘K</span>
          </div>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Search button */}
        <button
          onClick={onOpenCommandPalette}
          className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Theme Switcher */}
        <div className="relative" ref={themeMenuRef}>
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            title="Theme switch"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors relative"
          >
            <Palette className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {showThemeMenu && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="absolute right-0 mt-2 w-48 rounded-xl bg-[#0D101C] border border-white/10 shadow-2xl p-1.5 z-50 text-xs"
              >
                <div className="px-3 py-1.5 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                  Select Visual Mode
                </div>
                {[
                  { id: 'dark-default', name: 'Dark Void (Default)', icon: Moon },
                  { id: 'dark-cyber', name: 'Cyberpunk Neon', icon: Sparkles },
                  { id: 'dark-oled', name: 'OLED Pure Black', icon: Laptop },
                ].map((th) => (
                  <button
                    key={th.id}
                    onClick={() => {
                      onToggleTheme(th.id);
                      setShowThemeMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                      theme === th.id
                        ? 'bg-indigo-600/30 text-white font-medium'
                        : 'text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <th.icon className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{th.name}</span>
                    </div>
                    {theme === th.id && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Messages Button */}
        <button
          onClick={() => onNavigate('messages')}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors relative"
          title="Direct messages"
        >
          <MessageSquare className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 ring-2 ring-[#080A12]" />
        </button>

        {/* Notification Bell Dropdown */}
        <div className="relative" ref={notifMenuRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#0D101C] border border-white/10 shadow-2xl overflow-hidden z-50 text-xs"
              >
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-slate-900/60">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">Telemetry Alerts</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-indigo-500/20 text-cyan-300">
                      {unreadCount} new
                    </span>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={onMarkNotificationsRead}
                      className="text-[11px] text-cyan-400 hover:underline font-mono"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3.5 hover:bg-white/[0.03] transition-colors cursor-pointer ${
                        !n.read ? 'bg-indigo-500/[0.04]' : ''
                      }`}
                      onClick={() => onNavigate('notifications')}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-white">{n.title}</span>
                        <span className="text-[10px] font-mono text-slate-500">{n.timestamp}</span>
                      </div>
                      <p className="text-slate-400 leading-relaxed text-[11px]">{n.message}</p>
                    </div>
                  ))}
                </div>

                <div className="p-2 border-t border-white/5 text-center bg-slate-950/40">
                  <button
                    onClick={() => {
                      setShowNotifications(false);
                      onNavigate('notifications');
                    }}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium py-1"
                  >
                    View all alert history →
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Separator */}
        <div className="w-[1px] h-6 bg-white/10 mx-1 hidden sm:block" />

        {/* User Profile Avatar Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-white/5 transition-all text-left"
          >
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                alt="Alex Vance"
                className="w-8 h-8 rounded-xl object-cover ring-1 ring-white/20"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#080A12]" />
            </div>

            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-white leading-tight">Alex Vance</div>
              <div className="text-[10px] text-cyan-400 font-mono">VP Operations</div>
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#0D101C] border border-white/10 shadow-2xl p-2 z-50 text-xs"
              >
                <div className="px-3 py-2 border-b border-white/5 mb-1">
                  <div className="font-semibold text-white">Alex Vance</div>
                  <div className="text-[11px] text-slate-400 font-mono">alex.vance@aetheris.io</div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] text-emerald-400 font-mono">2FA Active • Level 4 Access</span>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onNavigate('settings');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5"
                  >
                    <User className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Executive Profile</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onNavigate('settings');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5"
                  >
                    <Key className="w-3.5 h-3.5 text-violet-400" />
                    <span>API Keys & Secrets</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onNavigate('settings');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5"
                  >
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <span>Organization & Team</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onNavigate('notifications');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5"
                  >
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Security Audit Logs</span>
                  </button>
                </div>

                <div className="border-t border-white/5 mt-1.5 pt-1.5">
                  <button
                    onClick={() => setShowUserMenu(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
