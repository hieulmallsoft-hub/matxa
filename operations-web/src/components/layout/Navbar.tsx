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
  user?: { name?: string | null; email?: string | null; role?: string } | null;
  isDemoMode?: boolean;
  onToggleDemoMode?: () => void;
  onOpenLoginModal?: () => void;
  onLogout?: () => void;
}

const PAGE_NAMES: Record<PageId, string> = {
  dashboard: 'Tổng quan & Telemetry 3D',
  analytics: 'Phân tích Doanh thu & Metric',
  orders: 'Quản lý Lịch đặt & Đơn dịch vụ',
  technicians: 'Danh bạ Kỹ thuật viên',
  applications: 'Duyệt hồ sơ & KYC KTV',
  catalog: 'Catalog Dịch vụ & Bảng giá',
  courses: 'Khóa học Đào tạo & Bài giảng',
  promotions: 'Voucher Khuyến mãi & Banner',
  customers: 'Danh sách Khách hàng',
  products: 'Sản phẩm & Vật tư',
  payments: 'Cổng thanh toán & Payout',
  transactions: 'Sổ cái Giao dịch Cryptographic',
  messages: 'Tin nhắn CSKH & Copilot',
  notifications: 'Cảnh báo & Sự cố Vận hành',
  settings: 'Cấu hình Hệ thống & Token',
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
  user,
  isDemoMode,
  onToggleDemoMode,
  onOpenLoginModal,
  onLogout,
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
    <header className="sticky top-0 z-30 w-full h-[66px] bg-white border-b border-[rgba(34,160,74,0.14)] px-4 sm:px-6 flex items-center justify-between shadow-[0_2px_16px_rgba(10,80,30,0.07)]">
      {/* Left: Mobile hamburger & Breadcrumb */}
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 rounded-lg text-[#6B8F67] hover:text-[#1A3818] hover:bg-[#EDF5E9]"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-[#3D9132] hover:text-[#1E5019] cursor-pointer font-bold tracking-wider transition-colors" onClick={() => onNavigate('dashboard')}>
            🌿 MATXA OPERATIONS
          </span>
          <span className="text-[#6B8F67]/50">/</span>
          <span className="text-[#3A6037] font-semibold tracking-wide">
            {PAGE_NAMES[currentPage] || currentPage.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Middle: Global Search Bar */}
      <div className="flex-1 max-w-md mx-4 hidden lg:block">
        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#F6FAF4] hover:bg-[#EDF5E9] border border-[rgba(94,163,80,0.18)] text-xs text-[#6B8F67] hover:text-[#1A3818] transition-all group"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-[#6B8F67] group-hover:text-[#3D9132] transition-colors" />
            <span>Tìm kiếm dịch vụ, lịch đặt, KTV...</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-[10px] bg-[#EDF5E9] px-2 py-0.5 rounded border border-[rgba(94,163,80,0.22)] text-[#3D9132]">
            <span>⌘K</span>
          </div>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Search button */}
        <button
          onClick={onOpenCommandPalette}
          className="lg:hidden p-2 rounded-xl text-[#6B8F67] hover:text-[#1A3818] hover:bg-[#EDF5E9] transition-colors"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Theme Switcher */}
        <div className="relative" ref={themeMenuRef}>
          <button
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            title="Giao diện"
            className="p-2 rounded-xl text-[#6B8F67] hover:text-[#1A3818] hover:bg-[#EDF5E9] transition-colors relative"
          >
            <Palette className="w-4 h-4" />
          </button>

          <AnimatePresence>
            {showThemeMenu && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="absolute right-0 mt-2 w-52 rounded-2xl bg-white border border-[rgba(94,163,80,0.20)] shadow-[0_8px_28px_rgba(30,100,20,0.14)] p-1.5 z-50 text-xs"
              >
                <div className="px-3 py-1.5 text-[10px] font-mono text-[#6B8F67] uppercase tracking-wider">
                  🎨 Chọn giao diện
                </div>
                {[
                  { id: 'nature-light', name: 'Thiên nhiên (Mặc định)', icon: Sun },
                  { id: 'nature-warm', name: 'Ấm áp Ban mai', icon: Sparkles },
                  { id: 'nature-dark', name: 'Rừng đêm Tĩnh lặng', icon: Moon },
                ].map((th) => (
                  <button
                    key={th.id}
                    onClick={() => {
                      onToggleTheme(th.id);
                      setShowThemeMenu(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all ${
                      theme === th.id
                        ? 'bg-[#EDF5E9] text-[#1E5019] font-semibold border border-[rgba(63,145,50,0.25)]'
                        : 'text-[#3A6037] hover:bg-[#F6FAF4]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <th.icon className="w-3.5 h-3.5 text-[#3D9132]" />
                      <span>{th.name}</span>
                    </div>
                    {theme === th.id && <Check className="w-3.5 h-3.5 text-[#3D9132]" />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Messages Button */}
        <button
          onClick={() => onNavigate('messages')}
          className="p-2 rounded-xl text-[#6B8F67] hover:text-[#1A3818] hover:bg-[#EDF5E9] transition-colors relative"
          title="Tin nhắn"
        >
          <MessageSquare className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#3D9132] ring-2 ring-white" />
        </button>

        {/* Notification Bell Dropdown */}
        <div className="relative" ref={notifMenuRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-xl text-[#6B8F67] hover:text-[#1A3818] hover:bg-[#EDF5E9] transition-colors relative"
            title="Thông báo"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E8B84B] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#E8B84B]"></span>
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-[rgba(94,163,80,0.18)] shadow-[0_12px_40px_rgba(30,100,20,0.14)] overflow-hidden z-50 text-xs"
              >
                <div className="px-4 py-3 border-b border-[rgba(94,163,80,0.12)] flex items-center justify-between bg-[#F6FAF4]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#1A3818]">🔔 Thông báo</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-[#EDF5E9] text-[#2C7024] border border-[rgba(63,145,50,0.25)]">
                      {unreadCount} mới
                    </span>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={onMarkNotificationsRead}
                      className="text-[11px] text-[#3D9132] hover:text-[#1E5019] hover:underline font-semibold"
                    >
                      Đánh dấu đã đọc
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-[rgba(94,163,80,0.10)]">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3.5 hover:bg-[#F6FAF4] transition-colors cursor-pointer ${
                        !n.read ? 'bg-[#EDF5E9]/50' : ''
                      }`}
                      onClick={() => onNavigate('notifications')}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-[#1A3818]">{n.title}</span>
                        <span className="text-[10px] font-mono text-[#6B8F67]">{n.timestamp}</span>
                      </div>
                      <p className="text-[#3A6037] leading-relaxed text-[11px]">{n.message}</p>
                    </div>
                  ))}
                </div>

                <div className="p-2 border-t border-[rgba(94,163,80,0.12)] text-center bg-[#F6FAF4]">
                  <button
                    onClick={() => {
                      setShowNotifications(false);
                      onNavigate('notifications');
                    }}
                    className="text-[11px] text-[#3D9132] hover:text-[#1E5019] font-semibold py-1 transition-colors"
                  >
                    Xem toàn bộ thông báo →
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Live / Demo Mode Badge */}
        <div className="hidden sm:flex items-center">
          <button
            onClick={onToggleDemoMode}
            title={isDemoMode ? 'Đang chạy Demo Sandbox. Bấm để đổi chế độ.' : 'Đang chạy Live API. Bấm để đổi chế độ.'}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              isDemoMode
                ? 'bg-[#EDF5E9] text-[#3A6037] border-[rgba(63,145,50,0.25)] hover:bg-[#D4EDCC]'
                : 'bg-[#EDF5E9] text-[#1E5019] border-[rgba(63,145,50,0.35)] hover:bg-[#D4EDCC]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isDemoMode ? 'bg-[#6B8F67]' : 'bg-[#3D9132] animate-pulse'}`} />
            <span>{isDemoMode ? '🌱 Demo' : '🌿 Live API'}</span>
          </button>
        </div>

        {/* Separator */}
        <div className="w-[1px] h-6 bg-[rgba(94,163,80,0.20)] mx-1 hidden sm:block" />

        {/* User Profile Avatar Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-[#EDF5E9] transition-all text-left"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#2C7024] via-[#3D9132] to-[#5FAF54] flex items-center justify-center font-bold text-white text-xs ring-1 ring-[rgba(63,145,50,0.25)]">
                {(user?.name || user?.email || 'A').slice(0, 1).toUpperCase()}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#3D9132] ring-2 ring-white" />
            </div>

            <div className="hidden sm:block text-left">
              <div className="text-xs font-bold text-[#1A3818] leading-tight">
                {user?.name || user?.email || 'Quản trị viên'}
              </div>
              <div className="text-[10px] text-[#6B8F67] font-semibold">{user?.role || 'ADMIN'}</div>
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-[#6B8F67] hidden sm:block" />
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                className="absolute right-0 mt-2 w-60 rounded-2xl bg-white border border-[rgba(94,163,80,0.20)] shadow-[0_12px_40px_rgba(30,100,20,0.14)] p-2 z-50 text-xs"
              >
                <div className="px-3 py-2.5 border-b border-[rgba(94,163,80,0.12)] mb-1 bg-[#F6FAF4] rounded-xl">
                  <div className="font-bold text-[#1A3818]">{user?.name || 'Quản trị viên'}</div>
                  <div className="text-[11px] text-[#6B8F67] font-mono truncate mt-0.5">{user?.email || 'admin@matxa.local'}</div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3D9132]" />
                    <span className="text-[10px] text-[#3A6037] font-semibold">
                      {isDemoMode ? '🌱 Chế độ Demo' : '🌿 Live API'}
                    </span>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenLoginModal?.();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#3A6037] hover:text-[#1A3818] hover:bg-[#EDF5E9] transition-colors"
                  >
                    <Key className="w-3.5 h-3.5 text-[#E8B84B]" />
                    <span>Đăng nhập Live API</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onToggleDemoMode?.();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#3A6037] hover:text-[#1A3818] hover:bg-[#EDF5E9] transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#3D9132]" />
                    <span>{isDemoMode ? 'Chuyển sang Live API' : 'Chuyển sang Demo'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onNavigate('settings');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#3A6037] hover:text-[#1A3818] hover:bg-[#EDF5E9] transition-colors"
                  >
                    <User className="w-3.5 h-3.5 text-[#3A6037]" />
                    <span>Cấu hình hệ thống</span>
                  </button>
                </div>

                <div className="border-t border-[rgba(94,163,80,0.12)] mt-1.5 pt-1.5">
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout?.();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#D4574A] hover:text-[#b03a2e] hover:bg-[rgba(212,87,74,0.08)] transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Đăng xuất</span>
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
