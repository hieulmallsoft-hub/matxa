import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
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
  Plus,
  ArrowRight,
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
  category: 'Trang' | 'Thao tác nhanh';
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
      title: 'Đến trang Tổng quan',
      subtitle: 'Xem tóm tắt tình hình vận hành hôm nay',
      icon: <LayoutDashboard className="w-4 h-4 text-[#2E7D4A]" />,
      category: 'Trang',
      action: () => {
        onNavigate('dashboard');
        onClose();
      },
    },
    {
      id: 'nav-analytics',
      title: 'Đến trang Doanh thu & Báo cáo',
      subtitle: 'Biểu đồ doanh thu, top dịch vụ & hiệu quả KTV',
      icon: <LineChart className="w-4 h-4 text-[#2E9B62]" />,
      category: 'Trang',
      action: () => {
        onNavigate('analytics');
        onClose();
      },
    },
    {
      id: 'nav-orders',
      title: 'Đến trang Lịch đặt & Đơn hàng',
      subtitle: 'Quản lý lịch hẹn, điều phối và xác nhận booking',
      icon: <CalendarDays className="w-4 h-4 text-[#4285D4]" />,
      category: 'Trang',
      action: () => {
        onNavigate('orders');
        onClose();
      },
    },
    {
      id: 'nav-technicians',
      title: 'Đến trang Kỹ thuật viên',
      subtitle: 'Danh sách KTV, đánh giá, lịch làm việc',
      icon: <UsersRound className="w-4 h-4 text-[#2E7D4A]" />,
      category: 'Trang',
      action: () => {
        onNavigate('technicians');
        onClose();
      },
    },
    {
      id: 'nav-applications',
      title: 'Đến trang Duyệt hồ sơ KTV',
      subtitle: 'Xét duyệt đơn đăng ký, CCCD và chứng chỉ',
      icon: <UserCheck className="w-4 h-4 text-[#F2A93B]" />,
      category: 'Trang',
      action: () => {
        onNavigate('applications');
        onClose();
      },
    },
    {
      id: 'nav-catalog',
      title: 'Đến trang Catalog dịch vụ',
      subtitle: 'Quản lý danh mục gói massage & bảng giá',
      icon: <FolderTree className="w-4 h-4 text-[#2E7D4A]" />,
      category: 'Trang',
      action: () => {
        onNavigate('catalog');
        onClose();
      },
    },
    {
      id: 'nav-courses',
      title: 'Đến trang Khóa học đào tạo',
      subtitle: 'Bài giảng và tài liệu chuyên môn cho KTV',
      icon: <GraduationCap className="w-4 h-4 text-[#4285D4]" />,
      category: 'Trang',
      action: () => {
        onNavigate('courses');
        onClose();
      },
    },
    {
      id: 'nav-promotions',
      title: 'Đến trang Khuyến mãi & Banner',
      subtitle: 'Voucher giảm giá, ưu đãi và banner ứng dụng',
      icon: <Sparkles className="w-4 h-4 text-[#F2A93B]" />,
      category: 'Trang',
      action: () => {
        onNavigate('promotions');
        onClose();
      },
    },
    {
      id: 'nav-customers',
      title: 'Đến trang Khách hàng',
      subtitle: 'Danh bạ khách hàng và lịch sử đặt dịch vụ',
      icon: <HeartHandshake className="w-4 h-4 text-[#E05B55]" />,
      category: 'Trang',
      action: () => {
        onNavigate('customers');
        onClose();
      },
    },
    {
      id: 'nav-messages',
      title: 'Đến trang Tin nhắn CSKH',
      subtitle: 'Hộp thư hỗ trợ và giải đáp thắc mắc khách hàng',
      icon: <MessageCircle className="w-4 h-4 text-[#4285D4]" />,
      category: 'Trang',
      action: () => {
        onNavigate('messages');
        onClose();
      },
    },
    // Quick Actions
    {
      id: 'act-create-order',
      title: 'Tạo lịch đặt mới',
      subtitle: 'Đặt lịch massage/spa trực tiếp cho khách hàng',
      icon: <Plus className="w-4 h-4 text-[#2E7D4A]" />,
      category: 'Thao tác nhanh',
      action: () => {
        onTriggerAction('create-order');
        onClose();
      },
    },
    {
      id: 'act-add-service',
      title: 'Thêm gói dịch vụ mới',
      subtitle: 'Tạo dịch vụ trị liệu mới vào catalog hệ thống',
      icon: <Plus className="w-4 h-4 text-[#2E7D4A]" />,
      category: 'Thao tác nhanh',
      action: () => {
        onTriggerAction('add-service');
        onClose();
      },
    },
    {
      id: 'act-create-promotion',
      title: 'Tạo mã khuyến mãi',
      subtitle: 'Tạo voucher giảm giá cho chiến dịch mới',
      icon: <Sparkles className="w-4 h-4 text-[#F2A93B]" />,
      category: 'Thao tác nhanh',
      action: () => {
        onTriggerAction('create-promotion');
        onClose();
      },
    },
  ];

  const filtered = items.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % (filtered.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filtered, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#1C2B20]/45 backdrop-blur-sm"
          />

          {/* Modal Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-xl bg-white rounded-2xl border border-[#E5EBE5] shadow-[0_20px_50px_rgba(28,43,32,0.16)] overflow-hidden z-10"
          >
            {/* Search Input Box */}
            <div className="flex items-center px-4 border-b border-[#E5EBE5]">
              <Search className="w-5 h-5 text-[#94A399]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Gõ lệnh tìm kiếm chức năng, dịch vụ, lịch đặt..."
                className="w-full px-3.5 py-4 bg-transparent text-sm text-[#1C2B20] placeholder-[#94A399] focus:outline-none"
              />
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F1F5EF] text-[#66756B] border border-[#E5EBE5]">
                ESC để đóng
              </span>
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#94A399]">
                  Không tìm thấy kết quả nào phù hợp với từ khóa "{query}"
                </div>
              ) : (
                filtered.map((item, idx) => {
                  const isSelected = selectedIndex === idx;
                  return (
                    <button
                      key={item.id}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-colors cursor-pointer ${
                        isSelected ? 'bg-[#EAF5EC] text-[#1C2B20]' : 'hover:bg-[#F6F8F4] text-[#1C2B20]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-white border border-[#E5EBE5] flex items-center justify-center flex-shrink-0 shadow-2xs">
                          {item.icon}
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-bold">{item.title}</div>
                          <div className="text-[11px] text-[#66756B] truncate">
                            {item.subtitle}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F1F5EF] text-[#66756B]">
                          {item.category}
                        </span>
                        <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-[#2E7D4A]' : 'text-slate-300'}`} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;
