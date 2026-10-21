import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CreditCard, CheckCircle2, Wallet, RefreshCw, QrCode, Smartphone, Banknote, ShieldCheck } from 'lucide-react';
import { useToast } from '../components/ui/ToastContainer';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { StatusBadge } from '../components/common/StatusBadge';

export const PaymentsPage: React.FC = () => {
  const { addToast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleInstantPayout = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      addToast({
        title: 'Đã tạo lệnh thanh toán đối soát',
        message: 'Đã giải ngân 42.850.000 đ vào tài khoản nhận của 18 KTV kết ca thành công.',
        type: 'success',
      });
    }, 800);
  };

  const GATEWAYS = [
    {
      name: 'VietQR Pro (Napas 247)',
      type: 'Chuyển khoản QR tức thì',
      fee: 'Miễn phí / 0đ',
      share: '64.5%',
      latency: '< 2 giây',
      status: 'Hoạt động tốt',
      icon: QrCode,
    },
    {
      name: 'Ví Điện Tử MoMo Business',
      type: 'Ví điện tử & Thẻ tín dụng',
      fee: '1.2% / giao dịch',
      share: '18.2%',
      latency: '< 1 giây',
      status: 'Hoạt động tốt',
      icon: Smartphone,
    },
    {
      name: 'Tiền mặt thu hộ (KTV Cod)',
      type: 'Khách thanh toán trực tiếp tại nhà',
      fee: '0 đ (đối soát cuối ngày)',
      share: '12.8%',
      latency: 'Kết ca',
      status: 'Hoạt động tốt',
      icon: Banknote,
    },
    {
      name: 'Cổng thẻ VNPay / OnePay',
      type: 'Thẻ quốc tế Visa, Mastercard, JCB',
      fee: '1.8% + 2.000 đ',
      share: '4.5%',
      latency: '< 3 giây',
      status: 'Hoạt động tốt',
      icon: CreditCard,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 pb-12"
    >
      {/* Header */}
      <PageHeader
        title="Cổng thanh toán & Quỹ vận hành"
        subtitle="Quản lý dòng tiền đối soát, thanh toán trực tuyến qua VietQR, MoMo và tiền mặt thu hộ của kỹ thuật viên"
        breadcrumbs={[
          { label: 'MATXXA', href: '#' },
          { label: 'Tài chính & Thanh toán' },
        ]}
        actions={
          <button
            onClick={handleInstantPayout}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white text-sm font-medium shadow-sm transition-all"
          >
            <Wallet className="w-4 h-4" />
            <span>{isProcessing ? 'Đang thực hiện...' : 'Giải ngân đối soát KTV'}</span>
          </button>
        }
      />

      {/* Gateway Balances */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-6 rounded-2xl bg-white border border-[#E5EBE5] shadow-sm relative overflow-hidden">
          <div className="text-xs font-semibold text-[#66756B] uppercase tracking-wider">
            Số dư vận hành sẵn sàng
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#1C2B20] mt-2">
            482.910.000 đ
          </div>
          <div className="text-xs text-[#2E7D4A] mt-2 flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-4 h-4 text-[#2E7D4A]" />
            Sẵn sàng giải ngân tức thì cho KTV
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-[#E5EBE5] shadow-sm">
          <div className="text-xs font-semibold text-[#66756B] uppercase tracking-wider">
            Đang giữ đối soát (Tạm giữ 24h)
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#1C2B20] mt-2">
            34.820.000 đ
          </div>
          <div className="text-xs text-[#66756B] mt-2">
            Giải phóng tự động sau khi khách xác nhận hoàn thành
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white border border-[#E5EBE5] shadow-sm">
          <div className="text-xs font-semibold text-[#66756B] uppercase tracking-wider">
            Tỷ lệ xử lý thành công
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-[#2E7D4A] mt-2">
            99.84%
          </div>
          <div className="text-xs text-[#66756B] mt-2">
            Không ghi nhận giao dịch lỗi hoặc nghẽn mạng trong tuần
          </div>
        </div>
      </div>

      {/* Gateway Telemetry Cards */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-[#1C2B20]">
          Trạng thái kênh thanh toán tích hợp
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {GATEWAYS.map((gw, idx) => {
            const Icon = gw.icon;
            return (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-white border border-[#E5EBE5] hover:border-[#2E7D4A]/30 transition-all space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#EAF5EC] text-[#2E7D4A] flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#1C2B20] text-sm">{gw.name}</h3>
                      <p className="text-xs text-[#66756B]">{gw.type}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#EAF5EC] text-[#2E7D4A] border border-[#2E7D4A]/20">
                    {gw.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs p-3 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5]">
                  <div>
                    <span className="text-[#66756B] block text-[11px]">Biểu phí dịch vụ</span>
                    <span className="text-[#1C2B20] font-semibold">{gw.fee}</span>
                  </div>
                  <div>
                    <span className="text-[#66756B] block text-[11px]">Tỷ trọng dòng tiền</span>
                    <span className="text-[#2E7D4A] font-semibold">{gw.share}</span>
                  </div>
                  <div>
                    <span className="text-[#66756B] block text-[11px]">Tốc độ xác thực</span>
                    <span className="text-[#1C2B20] font-semibold">{gw.latency}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

export default PaymentsPage;
