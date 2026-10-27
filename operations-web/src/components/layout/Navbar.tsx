import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Bell,
  MessageCircle,
  HelpCircle,
  User,
  Settings,
  LogOut,
  Menu,
  Check,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
  Sparkles,
  Database,
  Radio,
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
  dashboard: 'Tá»•ng quan',
  analytics: 'Doanh thu & BÃ¡o cÃ¡o',
  orders: 'Lá»‹ch Ä‘áº·t & ÄÆ¡n hÃ ng',
  technicians: 'Ká»¹ thuáº­t viÃªn',
  applications: 'Duyá»‡t há»“ sÆ¡ KTV',
  catalog: 'Dá»‹ch vá»¥',
  courses: 'KhÃ³a há»c Ä‘Ã o táº¡o',
  promotions: 'Khuyáº¿n mÃ£i & Banner',
  customers: 'KhÃ¡ch hÃ ng',
  products: 'Váº­t tÆ° & Sáº£n pháº©m',
  payments: 'Cá»•ng thanh toÃ¡n',
  transactions: 'Sá»• cÃ¡i Ä‘á»‘i soÃ¡t',
  messages: 'Tin nháº¯n CSKH',
  notifications: 'ThÃ´ng bÃ¡o há»‡ thá»‘ng',
  settings: 'Cáº¥u hÃ¬nh há»‡ thá»‘ng',
  technicianPolicy: 'ChÃ­nh sÃ¡ch KTV',
  venues: 'Ð?a di?m & Spa',
};

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onOpenCommandPalette,
  onNavigate,
  onOpenMobileMenu,
  notifications,
  onMarkNotificationsRead,
  user,
  isDemoMode,
  onToggleDemoMode,
  onOpenLoginModal,
  onLogout,
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 w-full h-[66px] bg-white border-b border-[#E5EBE5] px-4 sm:px-6 flex items-center justify-between shadow-[0_1px_4px_rgba(28,43,32,0.03)]">
      {/* Left: Mobile hamburger & Breadcrumb */}
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 rounded-xl text-[#66756B] hover:text-[#1C2B20] hover:bg-[#F6F8F4] transition-colors"
            title="Má»Ÿ menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
          <span
            className="text-[#2E7D4A] hover:text-[#256A3E] cursor-pointer font-bold tracking-tight transition-colors flex items-center gap-1.5"
            onClick={() => onNavigate('dashboard')}
          >
            MATXXA
          </span>
          <span className="text-[#94A399]">/</span>
          <span className="text-[#1C2B20] font-semibold tracking-tight">
            {PAGE_NAMES[currentPage] || currentPage}
          </span>
        </div>
      </div>

      {/* Middle: Global Search Bar */}
      <div className="flex-1 max-w-md mx-6 hidden lg:block">
        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#F6F8F4] hover:bg-[#EEF2EC] border border-[#E5EBE5] text-xs text-[#66756B] hover:text-[#1C2B20] transition-all group cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-[#94A399] group-hover:text-[#2E7D4A] transition-colors" />
            <span className="truncate">TÃ¬m kiáº¿m dá»‹ch vá»¥, lá»‹ch Ä‘áº·t, KTV, khÃ¡ch hÃ ng...</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-[#E5EBE5] text-[#2E7D4A] shadow-xs">
            <span>âŒ˜K</span>
          </div>
        </button>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mode Toggle Button: Live API vs Demo */}
        {onToggleDemoMode && (
          <button
            onClick={onToggleDemoMode}
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              isDemoMode
                ? 'bg-[#FEF6E9] text-[#B87A14] border-[#FBE3B8] hover:bg-[#FDECD0]'
                : 'bg-[#EAF5EC] text-[#2E7D4A] border-[#D0E7D5] hover:bg-[#DDF0E1]'
            }`}
            title={isDemoMode ? 'Äang dÃ¹ng dá»¯ liá»‡u mÃ´ phá»ng. Báº¥m Ä‘á»ƒ káº¿t ná»‘i API.' : 'Äang káº¿t ná»‘i API mÃ¡y chá»§.'}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isDemoMode ? 'bg-[#F2A93B]' : 'bg-[#2E9B62]'
              }`}
            />
            <span>{isDemoMode ? 'Cháº¿ Ä‘á»™ Demo' : 'Live API'}</span>
          </button>
        )}

        {/* Messages Shortcut */}
        <button
          onClick={() => onNavigate('messages')}
          className="relative p-2 rounded-xl text-[#66756B] hover:text-[#2E7D4A] hover:bg-[#F6F8F4] transition-colors"
          title="Tin nháº¯n CSKH"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#4285D4]" />
        </button>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifMenuRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl text-[#66756B] hover:text-[#2E7D4A] hover:bg-[#F6F8F4] transition-colors"
            title="ThÃ´ng bÃ¡o há»‡ thá»‘ng"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#E05B55] text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-[#E5EBE5] shadow-[0_10px_32px_-4px_rgba(28,43,32,0.12)] p-4 z-50 space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#E5EBE5]">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-[#1C2B20]">ThÃ´ng bÃ¡o há»‡ thá»‘ng</h3>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-[#EAF5EC] text-[#2E7D4A] text-[10px] font-bold">
                        {unreadCount} má»›i
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={onMarkNotificationsRead}
                      className="text-xs text-[#2E7D4A] hover:underline font-semibold"
                    >
                      ÄÃ£ Ä‘á»c táº¥t cáº£
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {notifications.slice(0, 4).map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-3 rounded-xl border text-xs transition-colors ${
                        !notif.read
                          ? 'bg-[#EAF5EC]/40 border-[#D0E7D5]'
                          : 'bg-[#F6F8F4] border-[#E5EBE5]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[#1C2B20] truncate">
                          {notif.title}
                        </span>
                        <span className="text-[10px] text-[#94A399] flex-shrink-0">
                          {notif.timestamp}
                        </span>
                      </div>
                      <p className="text-[#66756B] mt-1 leading-relaxed">{notif.message}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-[#E5EBE5] text-center">
                  <button
                    onClick={() => {
                      setShowNotifications(false);
                      onNavigate('notifications');
                    }}
                    className="text-xs text-[#2E7D4A] hover:underline font-semibold"
                  >
                    Xem táº¥t cáº£ thÃ´ng bÃ¡o â†’
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Profile Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 p-1.5 pr-2.5 rounded-xl hover:bg-[#F6F8F4] border border-transparent hover:border-[#E5EBE5] transition-all cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-[#EAF5EC] text-[#2E7D4A] font-bold text-xs flex items-center justify-center border border-[#D0E7D5]">
              {user?.name ? user.name.substring(0, 2).toUpperCase() : 'AD'}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-bold text-[#1C2B20] leading-tight">
                {user?.name || 'Quáº£n trá»‹ viÃªn'}
              </span>
              <span className="text-[10px] text-[#66756B] leading-tight">
                {user?.role || 'Admin'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#94A399]" />
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-[#E5EBE5] shadow-[0_10px_32px_-4px_rgba(28,43,32,0.12)] p-2 z-50 text-xs font-medium space-y-1"
              >
                <div className="px-3 py-2 border-b border-[#E5EBE5] mb-1">
                  <div className="font-bold text-[#1C2B20] text-sm truncate">
                    {user?.name || 'Quáº£n trá»‹ viÃªn'}
                  </div>
                  <div className="text-[11px] text-[#66756B] truncate">
                    {user?.email || 'admin@matxa.local'}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onNavigate('settings');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#1C2B20] hover:bg-[#F6F8F4] transition-colors"
                >
                  <User className="w-4 h-4 text-[#66756B]" />
                  <span>Há»“ sÆ¡ cÃ¡ nhÃ¢n</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onNavigate('settings');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#1C2B20] hover:bg-[#F6F8F4] transition-colors"
                >
                  <Settings className="w-4 h-4 text-[#66756B]" />
                  <span>CÃ i Ä‘áº·t há»‡ thá»‘ng</span>
                </button>

                {onOpenLoginModal && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenLoginModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#2E7D4A] hover:bg-[#EAF5EC] transition-colors"
                  >
                    <Database className="w-4 h-4" />
                    <span>ÄÄƒng nháº­p Live API</span>
                  </button>
                )}

                <div className="pt-1 border-t border-[#E5EBE5] mt-1">
                  {onLogout && (
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#E05B55] hover:bg-[#FDF0EF] transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>ÄÄƒng xuáº¥t</span>
                    </button>
                  )}
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
