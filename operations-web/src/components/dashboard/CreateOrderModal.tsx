import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { ShoppingBag, CreditCard, Sparkles, User, Tag } from 'lucide-react';
import { useToast } from '../ui/ToastContainer';
import { OrderItem } from '../../types/dashboard';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: (newOrder: OrderItem) => void;
}

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({
  isOpen,
  onClose,
  onOrderCreated,
}) => {
  const { addToast } = useToast();
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [productName, setProductName] = useState('Neural Accelerator Pod v3');
  const [amount, setAmount] = useState('3499');
  const [paymentMethod, setPaymentMethod] = useState<'Stripe' | 'Credit Card' | 'Apple Pay' | 'Crypto USDT'>('Stripe');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerEmail) {
      addToast({
        title: 'Missing Details',
        message: 'Please provide both customer name and email.',
        type: 'error',
      });
      return;
    }

    const newOrder: OrderItem = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      customer: {
        name: customerName,
        email: customerEmail,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
        initials: customerName.substring(0, 2).toUpperCase(),
      },
      product: {
        name: productName,
        sku: 'GEN-CORE-X',
        category: 'Compute Core',
      },
      date: 'Just now',
      amount: parseFloat(amount) || 1200,
      payment: {
        method: paymentMethod,
        cardLast4: '9921',
      },
      status: 'Processing',
    };

    onOrderCreated?.(newOrder);
    onClose();
    addToast({
      title: 'Order Created',
      message: `Successfully booked order ${newOrder.id} for ${customerName}`,
      type: 'success',
    });

    // Reset
    setCustomerName('');
    setCustomerEmail('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tạo Đơn / Lịch Hẹn Trị Liệu Mới"
      subtitle="Thêm giao dịch dịch vụ chăm sóc spa và khóa học trực tiếp"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-mono text-[#C7D9B5] mb-1">TÊN KHÁCH HÀNG</label>
          <div className="relative">
            <User className="w-4 h-4 text-[#94AB71] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="VD: Chị Nguyễn Lan Anh"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#001910] border border-[#385723]/50 text-xs text-[#FFFAF5] placeholder-[#94AB71]/60 focus:outline-none focus:border-[#94AB71]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-[#C7D9B5] mb-1">ĐỊA CHỈ EMAIL</label>
          <input
            type="email"
            required
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="khachhang@matxa.vn"
            className="w-full px-3 py-2 rounded-xl bg-[#001910] border border-[#385723]/50 text-xs text-[#FFFAF5] placeholder-[#94AB71]/60 focus:outline-none focus:border-[#94AB71]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-mono text-[#C7D9B5] mb-1">GÓI DỊCH VỤ / LIỆU TRÌNH</label>
            <select
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#001910] border border-[#385723]/50 text-xs text-[#FFFAF5] focus:outline-none focus:border-[#94AB71]"
            >
              <option value="Massage Thảo Dược Hoàng Gia">Massage Thảo Dược ($3,499)</option>
              <option value="Trị Liệu Dưỡng Sinh Chuyên Sâu">Dưỡng Sinh Chuyên Sâu ($1,850)</option>
              <option value="Gói Chăm Sóc Da Organic">Chăm Sóc Da Organic ($2,420)</option>
              <option value="Khóa Đào Tạo Kỹ Thuật Viên">Đào Tạo Kỹ Thuật Viên ($1,190)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono text-[#C7D9B5] mb-1">SỐ TIỀN ($ USD)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#001910] border border-[#385723]/50 text-xs text-[#FFFAF5] focus:outline-none focus:border-[#94AB71] font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-[#C7D9B5] mb-1">HÌNH THỨC THANH TOÁN</label>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            {(['Stripe', 'Credit Card', 'Apple Pay', 'Crypto USDT'] as const).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                  paymentMethod === method
                    ? 'bg-[#385723]/40 border-[#94AB71]/60 text-[#FFFAF5] font-semibold'
                    : 'bg-[#001910] border-[#385723]/30 text-[#C7D9B5]/70 hover:text-[#FFFAF5]'
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-[#385723]/30 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-[#C7D9B5]/80 hover:text-[#FFFAF5] cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#385723] via-[#4d7530] to-[#94AB71] text-[#FFFAF5] text-xs font-semibold shadow-lg shadow-[#385723]/40 border border-[#F9EDB2]/30 transition-all cursor-pointer"
          >
            Xác Nhận Đặt Lịch
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateOrderModal;
