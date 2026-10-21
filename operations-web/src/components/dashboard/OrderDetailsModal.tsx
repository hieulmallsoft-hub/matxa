import React from 'react';
import { Modal } from '../ui/Modal';
import { OrderItem } from '../../types/dashboard';
import {
  CreditCard,
  CheckCircle2,
  Calendar,
  User,
  ShoppingBag,
  Download,
  MapPin,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useToast } from '../ui/ToastContainer';
import { StatusBadge } from '../common/StatusBadge';

interface OrderDetailsModalProps {
  order: OrderItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  isOpen,
  onClose,
}) => {
  const { addToast } = useToast();

  if (!order) return null;

  const handleDownloadInvoice = () => {
    addToast({
      title: 'Đã tải hóa đơn',
      message: `Hóa đơn điện tử VAT cho đơn ${order.id} đã được tải về.`,
      type: 'success',
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Chi tiết lịch đặt • ${order.id}`}
      subtitle="Thông tin khách hàng, gói dịch vụ massage & trạng thái thanh toán"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Top Summary Banner */}
        <div className="p-4 rounded-xl bg-[#EAF5EC] border border-[#2E7D4A]/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white text-[#2E7D4A] flex items-center justify-center font-bold shadow-xs">
              <Sparkles className="w-5 h-5 text-[#2E7D4A]" />
            </div>
            <div>
              <div className="text-xs text-[#66756B]">Tổng tiền thanh toán</div>
              <div className="text-lg font-bold text-[#2E7D4A]">
                {order.amount.toLocaleString('vi-VN')} đ
              </div>
            </div>
          </div>
          <StatusBadge status={order.status} />
        </div>

        {/* 2-Column Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {/* Customer */}
          <div className="p-3.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] space-y-2">
            <div className="flex items-center gap-1.5 text-[#2E7D4A] font-semibold uppercase text-[11px]">
              <User className="w-3.5 h-3.5" /> Khách hàng
            </div>
            <div className="flex items-center gap-2.5">
              <img
                src={order.customer.avatar}
                alt={order.customer.name}
                className="w-9 h-9 rounded-full object-cover ring-1 ring-[#E5EBE5]"
              />
              <div>
                <div className="font-semibold text-sm text-[#1C2B20]">{order.customer.name}</div>
                <div className="text-[11px] text-[#66756B]">{order.customer.email}</div>
              </div>
            </div>
          </div>

          {/* Service */}
          <div className="p-3.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] space-y-2">
            <div className="flex items-center gap-1.5 text-[#2E7D4A] font-semibold uppercase text-[11px]">
              <ShoppingBag className="w-3.5 h-3.5" /> Dịch vụ đăng ký
            </div>
            <div>
              <div className="font-semibold text-sm text-[#1C2B20]">{order.product.name}</div>
              <div className="text-[11px] text-[#66756B]">Mã gói: {order.product.sku}</div>
            </div>
          </div>

          {/* Timing */}
          <div className="p-3.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] space-y-2">
            <div className="flex items-center gap-1.5 text-[#2E7D4A] font-semibold uppercase text-[11px]">
              <Clock className="w-3.5 h-3.5" /> Thời gian phục vụ
            </div>
            <div className="font-medium text-[#1C2B20]">{order.date}</div>
            <div className="text-[11px] text-[#66756B]">KTV đến trước 10 phút chuẩn bị</div>
          </div>

          {/* Payment */}
          <div className="p-3.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] space-y-2">
            <div className="flex items-center gap-1.5 text-[#2E7D4A] font-semibold uppercase text-[11px]">
              <CreditCard className="w-3.5 h-3.5" /> Phương thức thanh toán
            </div>
            <div className="font-medium text-[#1C2B20]">
              {order.payment.method} ({order.payment.cardLast4})
            </div>
            <div className="text-[11px] text-[#2E7D4A] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Đã xác thực thanh toán
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="pt-3 border-t border-[#E5EBE5] flex items-center justify-between">
          <button
            onClick={handleDownloadInvoice}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5EBE5] bg-white hover:bg-[#F6F8F4] text-xs font-medium text-[#1C2B20] transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#2E7D4A]" />
            <span>Tải hóa đơn VAT</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white text-xs font-medium transition-all"
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default OrderDetailsModal;
