import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  Plus,
  Download,
  Filter,
  UsersRound,
  Sparkles,
  CheckCircle2,
  Clock,
  User,
  Phone,
  MapPin,
  CreditCard,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { RecentOrdersTable } from '../components/dashboard/RecentOrdersTable';
import { CreateOrderModal } from '../components/dashboard/CreateOrderModal';
import { OrderItem } from '../types/dashboard';
import { useToast } from '../components/ui/ToastContainer';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { DetailDrawer } from '../components/common/DetailDrawer';
import { StatusBadge } from '../components/common/StatusBadge';

export const OrdersPage: React.FC = () => {
  const { addToast } = useToast();
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleExportCSV = () => {
    addToast({
      title: 'Xuất dữ liệu thành công',
      message: 'Danh sách lịch đặt (.csv) đã được tải xuống thành công.',
      type: 'success',
    });
  };

  const handleUpdateStatus = (newStatus: string) => {
    if (!selectedOrder) return;
    addToast({
      title: 'Cập nhật trạng thái',
      message: `Đơn hàng ${selectedOrder.id} đã chuyển sang trạng thái "${newStatus}".`,
      type: 'success',
    });
    setSelectedOrder(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6 pb-12"
    >
      {/* 1. Page Header */}
      <PageHeader
        title="Lịch đặt & Đơn hàng"
        subtitle="Quản lý và điều phối tất cả các ca trị liệu massage & spa tại nhà"
        badge="14 ca đang phục vụ"
        badgeTone="blue"
        breadcrumbs={[
          { label: 'MATXXA' },
          { label: 'Lịch đặt & Đơn hàng' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E5EBE5] text-xs font-semibold text-[#66756B] hover:text-[#1C2B20] hover:bg-[#F6F8F4] transition-all cursor-pointer shadow-2xs"
            >
              <Download className="w-4 h-4" />
              <span>Xuất CSV</span>
            </button>

            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white text-xs font-semibold shadow-sm shadow-[#2E7D4A]/25 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tạo lịch đặt mới</span>
            </button>
          </div>
        }
      />

      {/* 2. Order Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Tổng số lịch đặt tháng này"
          value="1.428 lịch"
          change={12.4}
          isPositive={true}
          caption="so với tháng 9"
          icon={<CalendarDays className="w-5 h-5" />}
          tone="primary"
          sparkline={[98, 105, 112, 118, 122, 130, 134, 142]}
        />
        <StatCard
          label="Giá trị đơn trung bình"
          value="680.000 đ"
          change={6.2}
          isPositive={true}
          caption="tăng 40.000 đ/đơn"
          icon={<Sparkles className="w-5 h-5" />}
          tone="success"
          sparkline={[640, 650, 655, 660, 670, 675, 680]}
        />
        <StatCard
          label="Tỷ lệ hoàn thành đúng giờ"
          value="98.6%"
          change={1.2}
          isPositive={true}
          caption="trung bình đến trước 10p"
          icon={<CheckCircle2 className="w-5 h-5" />}
          tone="info"
          sparkline={[96.5, 97.0, 97.5, 98.0, 98.4, 98.6]}
        />
        <StatCard
          label="Tỷ lệ hủy đơn"
          value="1.4%"
          change={-0.6}
          isPositive={true}
          caption="thấp hơn tiêu chuẩn ngành (5%)"
          icon={<Clock className="w-5 h-5" />}
          tone="warning"
          sparkline={[2.4, 2.1, 1.9, 1.8, 1.6, 1.5, 1.4]}
        />
      </div>

      {/* 3. Main Interactive Orders Table */}
      <RecentOrdersTable onSelectOrder={setSelectedOrder} />

      {/* 4. Booking Detail Right Drawer (as requested in spec) */}
      <DetailDrawer
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `Chi tiết lịch đặt ${selectedOrder.id}` : ''}
        subtitle="Thông tin khách hàng, gói trị liệu và tiến trình thực hiện"
        badge={selectedOrder ? <StatusBadge status={selectedOrder.status} size="sm" /> : undefined}
        footer={
          selectedOrder && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleUpdateStatus('Đã hủy')}
                className="px-3.5 py-2 rounded-xl border border-[#F8D2D0] bg-[#FDF0EF] text-[#D04A44] hover:bg-[#FCE3E1] text-xs font-semibold transition-colors"
              >
                Hủy lịch đặt
              </button>
              <button
                onClick={() => handleUpdateStatus('Hoàn thành')}
                className="px-4 py-2 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                Xác nhận hoàn thành
              </button>
            </div>
          )
        }
      >
        {selectedOrder && (
          <div className="space-y-6">
            {/* Customer Info Card */}
            <div className="p-4 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] space-y-3">
              <span className="text-xs font-bold text-[#66756B] uppercase tracking-wider block">
                Thông tin khách hàng
              </span>
              <div className="flex items-center gap-3">
                <img
                  src={selectedOrder.customer.avatar}
                  alt={selectedOrder.customer.name}
                  className="w-12 h-12 rounded-full object-cover ring-2 ring-[#EAF5EC]"
                />
                <div>
                  <h4 className="font-bold text-sm text-[#1C2B20]">
                    {selectedOrder.customer.name}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-[#66756B] mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-[#2E7D4A]" />
                    <span>+84 901 888 999</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#E5EBE5] flex items-start gap-2 text-xs text-[#66756B]">
                <MapPin className="w-3.5 h-3.5 text-[#2E7D4A] mt-0.5 flex-shrink-0" />
                <span>Số 18, Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh</span>
              </div>
            </div>

            {/* Service & Technician Card */}
            <div className="p-4 rounded-xl bg-white border border-[#E5EBE5] space-y-3 shadow-2xs">
              <span className="text-xs font-bold text-[#66756B] uppercase tracking-wider block">
                Dịch vụ & Kỹ thuật viên
              </span>
              <div className="flex justify-between items-start">
                <div>
                  <h5 className="font-bold text-sm text-[#1C2B20]">{selectedOrder.product.name}</h5>
                  <span className="text-xs text-[#66756B]">
                    Thời lượng: 90 phút • Trị liệu thảo dược
                  </span>
                </div>
                <span className="font-bold text-sm text-[#2E7D4A]">
                  {new Intl.NumberFormat('vi-VN').format(selectedOrder.amount)} đ
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#EAF5EC]/60 border border-[#D0E7D5] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#2E7D4A]" />
                  <span>Kỹ thuật viên phụ trách: <strong>Lê Thu Hương (4.98★)</strong></span>
                </div>
                <span className="text-[#2E7D4A] font-semibold">Đã nhận ca</span>
              </div>
            </div>

            {/* Timeline Booking */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#66756B] uppercase tracking-wider block">
                Tiến trình thực hiện lịch đặt
              </span>
              <div className="space-y-3 relative pl-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E5EBE5]">
                {[
                  { time: '09:00', title: 'Khách hàng đặt lịch thành công', done: true },
                  { time: '09:05', title: 'Hệ thống tự động gán KTV Lê Thu Hương', done: true },
                  { time: '09:15', title: 'Kỹ thuật viên bắt đầu di chuyển', done: true },
                  { time: '09:30', title: 'Đến nơi & bắt đầu thực hiện liệu trình', done: selectedOrder.status === 'Completed' || selectedOrder.status === 'Processing' },
                  { time: '11:00', title: 'Hoàn thành dịch vụ & nghiệm thu', done: selectedOrder.status === 'Completed' },
                ].map((step, idx) => (
                  <div key={idx} className="relative text-xs">
                    <span
                      className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                        step.done ? 'bg-[#2E7D4A]' : 'bg-[#D0DCD1]'
                      }`}
                    />
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold ${step.done ? 'text-[#1C2B20]' : 'text-[#94A399]'}`}>
                        {step.title}
                      </span>
                      <span className="text-[#94A399] font-mono">{step.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment & Notes */}
            <div className="p-4 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] space-y-2 text-xs">
              <div className="flex justify-between text-[#66756B]">
                <span>Phương thức thanh toán:</span>
                <span className="font-semibold text-[#1C2B20]">{selectedOrder.payment.cardLast4 || 'Chuyển khoản VietQR'}</span>
              </div>
              <div className="flex justify-between text-[#66756B]">
                <span>Trạng thái thanh toán:</span>
                <span className="font-semibold text-[#2E9B62]">Đã thanh toán đủ</span>
              </div>
              <div className="pt-2 border-t border-[#E5EBE5] text-[#66756B]">
                <strong>Ghi chú:</strong> Khách hay đau mỏi cơ cổ vai gáy, mong muốn tập trung kỹ vùng bả vai và gáy, dùng tinh dầu sả chanh.
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>

      {/* 5. Create Order Modal */}
      <CreateOrderModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </motion.div>
  );
};

export default OrdersPage;
