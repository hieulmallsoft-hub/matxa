import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  LayoutDashboard,
  LineChart,
  ShoppingBag,
  Users,
  Layers,
  CreditCard,
  Settings,
  Bell,
  MessageSquare,
  FilePlus,
  ArrowRight,
  Sparkles,
  Command as CommandIcon,
} from 'lucide-react';
import { PageId } from '../../types/dashboard';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: PageId) => void;
  onTriggerAction: (actionName: string) => void;
}

interface PaletteItem {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  category: 'Navigation' | 'Actions';
  shortcut?: string;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onTriggerAction,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items: PaletteItem[] = [
    {
      id: 'nav-dashboard',
      title: 'Go to Dashboard',
      subtitle: 'Main overview & telemetry control center',
      icon: <LayoutDashboard className="w-4 h-4 text-cyan-400" />,
      category: 'Navigation',
      shortcut: 'G D',
      action: () => {
        onNavigate('dashboard');
        onClose();
      },
    },
    {
      id: 'nav-analytics',
      title: 'Go to Analytics',
      subtitle: 'Revenue, conversion curves & cohort telemetry',
      icon: <LineChart className="w-4 h-4 text-violet-400" />,
      category: 'Navigation',
      shortcut: 'G A',
      action: () => {
        onNavigate('analytics');
        onClose();
      },
    },
    {
      id: 'nav-orders',
      title: 'Go to Orders',
      subtitle: 'Fulfilled, pending, and processing transactions',
      icon: <ShoppingBag className="w-4 h-4 text-blue-400" />,
      category: 'Navigation',
      shortcut: 'G O',
      action: () => {
        onNavigate('orders');
        onClose();
      },
    },
    {
      id: 'nav-customers',
      title: 'Go to Customers',
      subtitle: 'Customer directories, LTV & VIP accounts',
      icon: <Users className="w-4 h-4 text-emerald-400" />,
      category: 'Navigation',
      shortcut: 'G C',
      action: () => {
        onNavigate('customers');
        onClose();
      },
    },
    {
      id: 'nav-products',
      title: 'Go to Products',
      subtitle: 'Hardware pods, token licenses & inventory',
      icon: <Layers className="w-4 h-4 text-amber-400" />,
      category: 'Navigation',
      shortcut: 'G P',
      action: () => {
        onNavigate('products');
        onClose();
      },
    },
    {
      id: 'nav-technicians',
      title: 'Quản lý Kỹ thuật viên',
      subtitle: 'Danh bạ KTV, trạng thái hoạt động & đánh giá',
      icon: <Users className="w-4 h-4 text-emerald-400" />,
      category: 'Navigation',
      shortcut: 'G T',
      action: () => {
        onNavigate('technicians');
        onClose();
      },
    },
    {
      id: 'nav-applications',
      title: 'Duyệt hồ sơ KTV',
      subtitle: 'Xét duyệt hồ sơ ứng tuyển, ảnh KYC & xác thực',
      icon: <FilePlus className="w-4 h-4 text-amber-400" />,
      category: 'Navigation',
      action: () => {
        onNavigate('applications');
        onClose();
      },
    },
    {
      id: 'nav-catalog',
      title: 'Catalog & Bảng giá Dịch vụ',
      subtitle: 'Danh mục trị liệu, thời lượng & cấu hình giá',
      icon: <Layers className="w-4 h-4 text-teal-400" />,
      category: 'Navigation',
      action: () => {
        onNavigate('catalog');
        onClose();
      },
    },
    {
      id: 'nav-courses',
      title: 'Khóa học Đào tạo',
      subtitle: 'Quản lý bài giảng video, tài liệu PDF đào tạo',
      icon: <Sparkles className="w-4 h-4 text-indigo-400" />,
      category: 'Navigation',
      action: () => {
        onNavigate('courses');
        onClose();
      },
    },
    {
      id: 'nav-promotions',
      title: 'Khuyến mãi & Voucher',
      subtitle: 'Mã giảm giá, chiến dịch banner khuyến mãi',
      icon: <CreditCard className="w-4 h-4 text-rose-400" />,
      category: 'Navigation',
      action: () => {
        onNavigate('promotions');
        onClose();
      },
    },
    {
      id: 'nav-payments',
      title: 'Go to Payments',
      subtitle: 'Stripe, Apple Pay & crypto settlement nodes',
      icon: <CreditCard className="w-4 h-4 text-rose-400" />,
      category: 'Navigation',
      action: () => {
        onNavigate('payments');
        onClose();
      },
    },
    {
      id: 'nav-messages',
      title: 'Go to Messages',
      subtitle: 'Customer live inquiries & AI copilot',
      icon: <MessageSquare className="w-4 h-4 text-cyan-400" />,
      category: 'Navigation',
      action: () => {
        onNavigate('messages');
        onClose();
      },
    },
    {
      id: 'nav-notifications',
      title: 'Go to Notifications',
      subtitle: 'Telemetry alerts & security incidents',
      icon: <Bell className="w-4 h-4 text-yellow-400" />,
      category: 'Navigation',
      action: () => {
        onNavigate('notifications');
        onClose();
      },
    },
    {
      id: 'nav-settings',
      title: 'Go to Settings',
      subtitle: 'API keys, webhooks, security & team permissions',
      icon: <Settings className="w-4 h-4 text-slate-400" />,
      category: 'Navigation',
      shortcut: 'G S',
      action: () => {
        onNavigate('settings');
        onClose();
      },
    },
    {
      id: 'act-report',
      title: 'Generate New Performance Report',
      subtitle: 'Compile comprehensive PDF/CSV analytics bundle',
      icon: <FilePlus className="w-4 h-4 text-indigo-400" />,
      category: 'Actions',
      shortcut: '⌘ R',
      action: () => {
        onTriggerAction('new-report');
        onClose();
      },
    },
    {
      id: 'act-order',
      title: 'Create Direct Order',
      subtitle: 'Manual purchase order entry for enterprise client',
      icon: <Sparkles className="w-4 h-4 text-cyan-400" />,
      category: 'Actions',
      action: () => {
        onTriggerAction('create-order');
        onClose();
      },
    },
  ];

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 sm:pt-28">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-xl rounded-2xl bg-[#0D101C] border border-white/10 shadow-2xl shadow-indigo-950/50 overflow-hidden z-10"
          >
            {/* Search Input Bar */}
            <div className="flex items-center px-4 py-3.5 border-b border-white/10 gap-3">
              <Search className="w-5 h-5 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Type a command or search sections..."
                className="flex-1 bg-transparent border-none text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-0"
              />
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-white/5 border border-white/10 text-slate-400">
                ESC to close
              </span>
            </div>

            {/* List Results */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {filteredItems.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  No matching commands found for "{query}"
                </div>
              ) : (
                filteredItems.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={item.id}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-gradient-to-r from-indigo-600/30 to-cyan-600/20 text-white border border-indigo-500/30'
                          : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                          {item.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-white truncate">{item.title}</div>
                          <div className="text-xs text-slate-400 truncate">{item.subtitle}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.shortcut && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/40 text-slate-400 border border-white/10">
                            {item.shortcut}
                          </span>
                        )}
                        <ArrowRight
                          className={`w-4 h-4 transition-transform ${
                            isSelected ? 'translate-x-1 text-cyan-400' : 'text-slate-600 opacity-0'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 bg-black/40 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <CommandIcon className="w-3.5 h-3.5" /> Navigate with ↑ ↓, press Enter to select
              </span>
              <span>AETHERIS QUICK SEARCH</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;
