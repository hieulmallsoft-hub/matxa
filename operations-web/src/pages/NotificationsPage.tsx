import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldAlert,
  Trash2,
  Check,
  Filter,
  CreditCard,
  CalendarDays,
  Server,
  Webhook,
  Send,
} from 'lucide-react';
import { NotificationItem } from '../types/dashboard';
import { useToast } from '../components/ui/ToastContainer';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

interface SpaNotification {
  id: string;
  title: string;
  content: string;
  module: 'Thanh toán' | 'Booking' | 'Kỹ thuật viên' | 'Hệ thống' | 'Thông báo Push';
  severity: 'info' | 'warning' | 'danger';
  time: string;
  isResolved: boolean;
  read: boolean;
}

const SPA_NOTIFICATIONS: SpaNotification[] = [
  {
    id: 'nt-1',
    title: 'Hồ sơ kỹ thuật viên mới chờ duyệt',
    content: 'KTV Vũ Thị Ngọc vừa tải lên CCCD và chứng chỉ hành nghề Y học Cổ truyền tại Hà Nội. Cần admin kiểm tra và xác thực KYC.',
    module: 'Kỹ thuật viên',
    severity: 'warning',
    time: '10 phút trước',
    isResolved: false,
    read: false,
  },
  {
    id: 'nt-2',
    title: 'Booking chưa có KTV nhận ca (Quá hạn 15 phút)',
    content: 'Lịch đặt #BK-1045 tại Cầu Giấy lúc 16:00 chưa có kỹ thuật viên nhận. Đã gửi thông báo ưu tiên đến 5 KTV gần nhất.',
    module: 'Booking',
    severity: 'danger',
    time: '25 phút trước',
    isResolved: false,
    read: false,
  },
  {
    id: 'nt-3',
    title: 'Thanh toán VietQR hoàn tất tự động',
    content: 'Đơn đặt #BK-1046 của khách hàng Trần Thu Hà (750.000 đ) đã được đối soát tự động thành công qua cổng thanh toán.',
    module: 'Thanh toán',
    severity: 'info',
    time: '42 phút trước',
    isResolved: true,
    read: true,
  },
  {
    id: 'nt-4',
    title: 'Lỗi gửi tin nhắn SMS Zalo ZNS cho khách hàng',
    content: 'Đầu số Zalo ZNS phản hồi timeout mã lỗi #408 khi gửi mã OTP đăng nhập. Hệ thống đã tự động chuyển hướng sang SMS dự phòng.',
    module: 'Thông báo Push',
    severity: 'warning',
    time: '2 giờ trước',
    isResolved: true,
    read: true,
  },
  {
    id: 'nt-5',
    title: 'Tối ưu định tuyến di chuyển kỹ thuật viên',
    content: 'Cập nhật bản đồ giao thông giúp giảm trung bình 12% thời gian di chuyển giữa các ca trị liệu tại TP. Hồ Chí Minh.',
    module: 'Hệ thống',
    severity: 'info',
    time: '5 giờ trước',
    isResolved: true,
    read: true,
  },
];

export const NotificationsPage: React.FC = () => {
  const { addToast } = useToast();
  const [notifications, setNotifications] = useState<SpaNotification[]>(SPA_NOTIFICATIONS);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'info' | 'warning' | 'danger'>('ALL');

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    addToast({
      title: 'Đã đánh dấu đọc',
      message: 'Tất cả thông báo đã được lưu trữ.',
      type: 'info',
    });
  };

  const handleToggleResolve = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isResolved: !n.isResolved } : n))
    );
    addToast({
      title: 'Cập nhật trạng thái',
      message: 'Đã thay đổi trạng thái xử lý sự cố.',
      type: 'success',
    });
  };

  const filtered = notifications.filter((n) => {
    if (severityFilter === 'ALL') return true;
    return n.severity === severityFilter;
  });

  const severityBadges = {
    info: { label: 'Thông tin', bg: 'bg-[#EDF4FC]', text: 'text-[#2970C2]', border: 'border-[#CDE0F8]' },
    warning: { label: 'Cảnh báo', bg: 'bg-[#FEF6E9]', text: 'text-[#B87A14]', border: 'border-[#FBE3B8]' },
    danger: { label: 'Quan trọng', bg: 'bg-[#FDF0EF]', text: 'text-[#D04A44]', border: 'border-[#F8D2D0]' },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6 pb-12"
    >
      {/* Header */}
      <PageHeader
        title="Thông báo hệ thống"
        subtitle="Theo dõi sự kiện vận hành, cảnh báo booking và trạng thái xử lý nghiệp vụ"
        badge="Cập nhật tự động"
        badgeTone="green"
        breadcrumbs={[
          { label: 'MATXXA' },
          { label: 'Thông báo hệ thống' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E5EBE5] text-xs font-semibold text-[#66756B] hover:text-[#1C2B20] hover:bg-[#F6F8F4] transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Đánh dấu đã đọc</span>
            </button>
          </div>
        }
      />

      {/* Severity Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-[#F1F5EF] rounded-xl border border-[#E5EBE5] max-w-fit">
        {[
          { key: 'ALL', label: 'Tất cả thông báo' },
          { key: 'danger', label: 'Quan trọng (Cần xử lý)' },
          { key: 'warning', label: 'Cảnh báo vận hành' },
          { key: 'info', label: 'Thông tin hệ thống' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setSeverityFilter(f.key as any)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              severityFilter === f.key
                ? 'bg-white text-[#2E7D4A] shadow-xs'
                : 'text-[#66756B] hover:text-[#1C2B20]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filtered.map((item) => {
          const sev = severityBadges[item.severity];
          return (
            <div
              key={item.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                !item.read
                  ? 'bg-white border-[#2E7D4A]/40 shadow-xs'
                  : 'bg-white border-[#E5EBE5] hover:border-[#D0DCD1]'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0">
                <div className={`p-2.5 rounded-xl border ${sev.bg} ${sev.text} ${sev.border} flex-shrink-0 mt-0.5`}>
                  {item.severity === 'danger' && <AlertTriangle className="w-5 h-5 text-[#E05B55]" />}
                  {item.severity === 'warning' && <AlertTriangle className="w-5 h-5 text-[#F2A93B]" />}
                  {item.severity === 'info' && <Info className="w-5 h-5 text-[#4285D4]" />}
                </div>

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-[#1C2B20]">{item.title}</span>
                    <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold border ${sev.bg} ${sev.text} ${sev.border}`}>
                      {sev.label}
                    </span>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-semibold bg-[#F1F5EF] text-[#66756B]">
                      {item.module}
                    </span>
                  </div>
                  <p className="text-xs text-[#66756B] leading-relaxed max-w-2xl">{item.content}</p>
                  <span className="text-[11px] text-[#94A399] block font-mono">{item.time}</span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-end sm:self-auto flex-shrink-0">
                <button
                  onClick={() => handleToggleResolve(item.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    item.isResolved
                      ? 'bg-[#EBF8F1] text-[#2E9B62] border-[#C8EED7]'
                      : 'bg-[#FEF6E9] text-[#B87A14] border-[#FBE3B8] hover:bg-[#FDECD0]'
                  }`}
                >
                  {item.isResolved ? '✓ Đã xử lý' : 'Đánh dấu đã xử lý'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default NotificationsPage;
