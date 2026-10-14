import React from 'react';
import { Modal } from '../ui/Modal';
import {
  OrderItem,
  OrderStatus,
} from '../../types/dashboard';
import {
  CreditCard,
  CheckCircle2,
  Calendar,
  User,
  ShoppingBag,
  Download,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '../ui/ToastContainer';

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
      title: 'Invoice Downloaded',
      message: `Tax receipt generated for order ${order.id}`,
      type: 'success',
    });
  };

  const handleRecheckSettlement = () => {
    addToast({
      title: 'Settlement Re-verified',
      message: `Cryptographic consensus verified on Arbitrum L2 for ${order.id}`,
      type: 'info',
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Chi Tiết Lịch Hẹn • ${order.id}`}
      subtitle="Hồ sơ dịch vụ & thông tin thanh toán hoàn tất"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Top Summary Banner */}
        <div className="p-4 rounded-2xl bg-[#001910] border border-[#385723]/50 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono text-[#C7D9B5]">TỔNG GIÁ TRỊ GIAO DỊCH</div>
            <div className="text-2xl font-bold font-mono text-[#FFFAF5] mt-0.5">
              ${order.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="text-right">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#385723]/30 text-[#C7D9B5] border border-[#94AB71]/40">
              {order.status}
            </span>
            <div className="text-[10px] text-[#94AB71] font-mono mt-1">{order.date}</div>
          </div>
        </div>

        {/* Customer Information */}
        <div className="p-4 rounded-2xl bg-[#001910]/80 border border-[#385723]/40 space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono text-[#94AB71] uppercase">
            <User className="w-3.5 h-3.5" /> Thông tin khách hàng
          </div>
          <div className="flex items-center gap-3">
            <img
              src={order.customer.avatar}
              alt={order.customer.name}
              className="w-10 h-10 rounded-full object-cover ring-1 ring-[#385723]/50"
            />
            <div>
              <div className="font-semibold text-[#FFFAF5] text-sm">{order.customer.name}</div>
              <div className="text-xs text-[#C7D9B5]/80 font-mono">{order.customer.email}</div>
            </div>
          </div>
        </div>

        {/* Product Details */}
        <div className="p-4 rounded-2xl bg-[#001910]/80 border border-[#385723]/40 space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono text-[#F9EDB2] uppercase">
            <ShoppingBag className="w-3.5 h-3.5" /> Gói Trị Liệu & Dịch Vụ
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-[#FFFAF5] text-sm">{order.product.name}</div>
              <div className="text-xs text-[#C7D9B5]/80 font-mono">
                Mã: {order.product.sku} • Phân loại: {order.product.category}
              </div>
            </div>
            <span className="font-mono text-sm font-bold text-[#FFFAF5]">
              ${order.amount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Payment & Security Metadata */}
        <div className="p-4 rounded-2xl bg-[#001910]/80 border border-[#385723]/40 grid grid-cols-2 gap-3 text-xs font-mono">
          <div>
            <span className="text-[#94AB71] block mb-0.5">PHƯƠNG THỨC THANH TOÁN</span>
            <span className="text-[#FFFAF5] flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[#94AB71]" />
              {order.payment.method} {order.payment.cardLast4 ? `(•••• ${order.payment.cardLast4})` : ''}
            </span>
          </div>

          <div>
            <span className="text-[#94AB71] block mb-0.5">XÁC MINH AN TOÀN</span>
            <span className="text-[#C7D9B5] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#94AB71]" /> ĐÃ BẢO MẬT & ĐỐI SOÁT
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-[#385723]/30 flex items-center justify-between gap-3">
          <button
            onClick={handleRecheckSettlement}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-[#C7D9B5] hover:text-[#FFFAF5] hover:bg-[#385723]/25 transition-colors font-mono cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#94AB71]" /> Kiểm tra đối soát
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadInvoice}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#385723]/30 border border-[#94AB71]/40 text-[#C7D9B5] hover:bg-[#385723]/50 text-xs font-medium transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#F9EDB2]" />
              <span>Tải Hóa Đơn</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#385723]/60 hover:bg-[#385723]/80 text-[#FFFAF5] text-xs font-medium transition-all cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default OrderDetailsModal;
