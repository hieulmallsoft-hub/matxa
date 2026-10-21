import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { CalendarDays, User, Phone, Sparkles, MapPin, CreditCard } from 'lucide-react';
import { useToast } from '../ui/ToastContainer';
import { OrderItem } from '../../types/dashboard';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: (newOrder: OrderItem) => void;
}

const SPA_SERVICES = [
  { name: 'Massage Trị Liệu Cổ Vai Gáy Chuyên Sâu', price: 650000, category: 'Trị liệu' },
  { name: 'Massage Đá Nóng Himalaya Phục Hồi', price: 750000, category: 'Đá nóng' },
  { name: 'Massage Shiatsu Nhật Bản & Bấm Huyệt', price: 550000, category: 'Bấm huyệt' },
  { name: 'Chăm Sóc Da Mặt Nâng Cơ Chuyên Sâu', price: 890000, category: 'Spa mặt' },
  { name: 'Combo Thư Giãn Toàn Diện 120 Phút', price: 1250000, category: 'Combo VIP' },
  { name: 'Bấm Huyệt Chân Thảo Dược Đông Y', price: 450000, category: 'Bấm huyệt' },
];

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({
  isOpen,
  onClose,
  onOrderCreated,
}) => {
  const { addToast } = useToast();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedService, setSelectedService] = useState(SPA_SERVICES[0].name);
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Credit Card' | 'Stripe'>('Credit Card');

  const chosenService = SPA_SERVICES.find((s) => s.name === selectedService) || SPA_SERVICES[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) {
      addToast({
        title: 'Thiếu thông tin',
        message: 'Vui lòng nhập họ tên và số điện thoại khách hàng.',
        type: 'error',
      });
      return;
    }

    const newOrder: OrderItem = {
      id: `BK-${Math.floor(1000 + Math.random() * 9000)}`,
      customer: {
        name: customerName,
        email: customerPhone,
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80',
        initials: customerName.substring(0, 2).toUpperCase(),
      },
      product: {
        name: chosenService.name,
        sku: 'SRV-BOOKING',
        category: chosenService.category,
      },
      date: 'Hôm nay, ' + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      amount: chosenService.price,
      payment: {
        method: paymentMethod,
        cardLast4: paymentMethod === 'Credit Card' ? 'Tiền mặt' : 'VietQR',
      },
      status: 'Processing',
    };

    onOrderCreated?.(newOrder);
    onClose();
    addToast({
      title: 'Tạo lịch đặt thành công',
      message: `Đã tiếp nhận lịch hẹn ${newOrder.id} cho khách hàng ${customerName}.`,
      type: 'success',
    });

    setCustomerName('');
    setCustomerPhone('');
    setAddress('');
    setNotes('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tạo Lịch Đặt Massage & Spa Mới"
      subtitle="Nhập thông tin khách hàng và dịch vụ trị liệu tại nhà"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#1C2B20] mb-1">
            Họ và tên khách hàng *
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-[#94A399] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="VD: Chị Nguyễn Lan Anh"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs text-[#1C2B20] placeholder-[#94A399] focus:outline-none focus:border-[#2E7D4A] focus:ring-1 focus:ring-[#2E7D4A]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#1C2B20] mb-1">
            Số điện thoại liên hệ *
          </label>
          <div className="relative">
            <Phone className="w-4 h-4 text-[#94A399] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="tel"
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="VD: 0901 888 999"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs text-[#1C2B20] placeholder-[#94A399] focus:outline-none focus:border-[#2E7D4A] focus:ring-1 focus:ring-[#2E7D4A]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#1C2B20] mb-1">
            Gói dịch vụ massage / spa *
          </label>
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A] focus:ring-1 focus:ring-[#2E7D4A]"
          >
            {SPA_SERVICES.map((srv) => (
              <option key={srv.name} value={srv.name}>
                {srv.name} — {new Intl.NumberFormat('vi-VN').format(srv.price)} đ
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#1C2B20] mb-1">
            Địa chỉ phục vụ tại nhà
          </label>
          <div className="relative">
            <MapPin className="w-4 h-4 text-[#94A399] absolute left-3 top-3" />
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs text-[#1C2B20] placeholder-[#94A399] focus:outline-none focus:border-[#2E7D4A] focus:ring-1 focus:ring-[#2E7D4A]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#1C2B20] mb-1">
            Hình thức thanh toán
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${paymentMethod === 'Stripe' ? 'bg-[#EAF5EC] border-[#2E7D4A] text-[#2E7D4A] font-semibold' : 'bg-[#F6F8F4] border-[#E5EBE5] text-[#66756B]'}`}>
              <input
                type="radio"
                name="pay"
                checked={paymentMethod === 'Stripe'}
                onChange={() => setPaymentMethod('Stripe')}
                className="hidden"
              />
              <span>Chuyển khoản VietQR</span>
            </label>
            <label className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${paymentMethod === 'Credit Card' ? 'bg-[#EAF5EC] border-[#2E7D4A] text-[#2E7D4A] font-semibold' : 'bg-[#F6F8F4] border-[#E5EBE5] text-[#66756B]'}`}>
              <input
                type="radio"
                name="pay"
                checked={paymentMethod === 'Credit Card'}
                onChange={() => setPaymentMethod('Credit Card')}
                className="hidden"
              />
              <span>Tiền mặt sau dịch vụ</span>
            </label>
          </div>
        </div>

        <div className="pt-3 border-t border-[#E5EBE5] flex items-center justify-between">
          <div>
            <span className="text-[11px] text-[#66756B] block">Tạm tính:</span>
            <span className="text-base font-bold text-[#2E7D4A]">
              {new Intl.NumberFormat('vi-VN').format(chosenService.price)} đ
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#E5EBE5] text-xs font-semibold text-[#66756B] hover:bg-[#F6F8F4]"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white text-xs font-semibold shadow-sm shadow-[#2E7D4A]/25 transition-all cursor-pointer"
            >
              Xác nhận tạo lịch
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default CreateOrderModal;
