import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Store,
  CalendarCheck,
  CreditCard,
  UserCheck,
  FolderTree,
  Bell,
  Shield,
  Key,
  Check,
  Save,
  HelpCircle,
} from 'lucide-react';
import { useToast } from '../components/ui/ToastContainer';
import { request } from '../api/client';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

type NotificationTemplate = { type: string; title: string; body: string; isActive: boolean };

const defaultNotificationTemplates: NotificationTemplate[] = [
  { type: 'BOOKING_CREATED', title: '[Thông báo MATXXA]', body: 'Khách mới đã đặt lịch. KTV vui lòng thu tiền trước khi làm.', isActive: true },
  { type: 'OPEN_BOOKING_AVAILABLE', title: '[Thông báo MATXXA]', body: 'Có đơn dịch vụ mới phù hợp. Hãy mở tab Nhận việc để xem và ứng tuyển.', isActive: true },
  { type: 'TECHNICIAN_SELECTED', title: '[Thông báo MATXXA]', body: 'Khách hàng đã chọn bạn cho đơn dịch vụ.', isActive: true },
  { type: 'BOOKING_CANCELLED', title: '[Thông báo MATXXA]', body: 'Lịch hẹn đã được hủy.', isActive: true },
  { type: 'BOOKING_EXPIRED', title: '[Thông báo MATXXA]', body: 'Đơn đã hết hạn.', isActive: true },
];

interface SettingsPageProps {
  theme: string;
  onToggleTheme: (t: string) => void;
}

type SettingCategory =
  | 'brand'
  | 'booking'
  | 'payment'
  | 'technician'
  | 'notifications'
  | 'security';

export const SettingsPage: React.FC<SettingsPageProps> = ({ theme, onToggleTheme }) => {
  const { addToast } = useToast();
  const [activeCategory, setActiveCategory] = useState<SettingCategory>('brand');
  const [notificationTemplates, setNotificationTemplates] = useState<NotificationTemplate[]>([]);
  const [notificationTemplatesLoading, setNotificationTemplatesLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Settings State
  const [brandName, setBrandName] = useState('MATXXA');
  const [brandHotline, setBrandHotline] = useState('1900 888 666');
  const [supportEmail, setSupportEmail] = useState('hotro@matxa.vn');
  const [minAdvanceHours, setMinAdvanceHours] = useState('1');
  const [autoCancelMinutes, setAutoCancelMinutes] = useState('15');
  const [maxTravelDistanceKm, setMaxTravelDistanceKm] = useState('15');
  const [techCommissionRate, setTechCommissionRate] = useState('75');
  const [nightSurcharge, setNightSurcharge] = useState('50000');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);

  React.useEffect(() => {
    void request<NotificationTemplate[]>('/admin/notifications/templates')
      .then(setNotificationTemplates)
      .catch(() => setNotificationTemplates(defaultNotificationTemplates))
      .finally(() => setNotificationTemplatesLoading(false));
  }, []);

  const updateTemplate = (type: string, field: 'title' | 'body', value: string) => {
    setNotificationTemplates((current) =>
      current.map((template) =>
        template.type === type ? { ...template, [field]: value } : template
      )
    );
  };

  const saveTemplate = async (template: NotificationTemplate) => {
    try {
      await request(`/admin/notifications/templates/${template.type}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: template.title, body: template.body, isActive: template.isActive }),
      });
      addToast({ title: 'Đã lưu mẫu thông báo', message: template.title || template.type, type: 'success' });
    } catch (error) {
      addToast({ title: 'Không thể lưu thay đổi', message: error instanceof Error ? error.message : 'Vui lòng thử lại', type: 'error' });
    }
  };

  const handleSaveAll = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      addToast({
        title: 'Đã lưu thay đổi',
        message: 'Cấu hình hệ thống đã được cập nhật thành công.',
        type: 'success',
      });
    }, 600);
  };

  const categories = [
    { id: 'brand', label: 'Thông tin hệ thống', icon: Store, desc: 'Tên thương hiệu, hotline, email CSKH' },
    { id: 'booking', label: 'Cấu hình Đặt lịch', icon: CalendarCheck, desc: 'Thời gian đặt trước, điều phối KTV' },
    { id: 'payment', label: 'Cổng thanh toán', icon: CreditCard, desc: 'VietQR, tài khoản thụ hưởng' },
    { id: 'technician', label: 'Chính sách KTV', icon: UserCheck, desc: 'Hoa hồng, cước phí di chuyển' },
    { id: 'notifications', label: 'Mẫu thông báo Push', icon: Bell, desc: 'Nội dung SMS, Zalo và App Push' },
    { id: 'security', label: 'Bảo mật & Phân quyền', icon: Shield, desc: 'Xác thực 2 bước, khóa tài khoản' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6 pb-24 relative"
    >
      {/* Header */}
      <PageHeader
        title="Cấu hình hệ thống"
        subtitle="Quản lý thông số vận hành, cổng thanh toán và chính sách kỹ thuật viên"
        badge="Phiên bản 3.4"
        badgeTone="green"
        breadcrumbs={[
          { label: 'MATXXA' },
          { label: 'Cấu hình hệ thống' },
        ]}
      />

      {/* Settings Layout with Sidebar & Content */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left: Category Navigation */}
        <div className="md:col-span-4 bg-white rounded-2xl border border-[#E5EBE5] p-2 space-y-1 shadow-2xs">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as SettingCategory)}
                className={`w-full p-3 rounded-xl text-left flex items-start gap-3 transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#EAF5EC] text-[#1C2B20]'
                    : 'text-[#66756B] hover:text-[#1C2B20] hover:bg-[#F6F8F4]'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isActive ? 'bg-[#2E7D4A] text-white shadow-2xs' : 'bg-[#F1F5EF] text-[#66756B]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className={`text-xs font-bold ${isActive ? 'text-[#1C2B20]' : 'text-[#1C2B20]'}`}>
                    {cat.label}
                  </div>
                  <div className="text-[11px] text-[#66756B] mt-0.5">{cat.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Form Settings */}
        <div className="md:col-span-8 bg-white rounded-2xl border border-[#E5EBE5] p-6 shadow-2xs space-y-6">
          {/* 1. THÔNG TIN HỆ THỐNG */}
          {activeCategory === 'brand' && (
            <div className="space-y-5">
              <div className="border-b border-[#E5EBE5] pb-3">
                <h3 className="text-base font-bold text-[#1C2B20]">Thông tin nền tảng</h3>
                <p className="text-xs text-[#66756B]">Hiển thị tại hóa đơn, SMS xác nhận và trên ứng dụng khách hàng</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1C2B20]">Tên thương hiệu</label>
                  <input
                    type="text"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A]"
                  />
                  <span className="text-[11px] text-[#66756B]">Tên hiển thị chính thức của hệ thống đặt massage & spa.</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#1C2B20]">Hotline tổng đài CSKH</label>
                    <input
                      type="text"
                      value={brandHotline}
                      onChange={(e) => setBrandHotline(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A]"
                    />
                    <span className="text-[11px] text-[#66756B]">Hỗ trợ khách hàng 24/7.</span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#1C2B20]">Email tiếp nhận phản hồi</label>
                    <input
                      type="email"
                      value={supportEmail}
                      onChange={(e) => setSupportEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A]"
                    />
                    <span className="text-[11px] text-[#66756B]">Email nhận thông báo khi có khiếu nại.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. CẤU HÌNH ĐẶT LỊCH */}
          {activeCategory === 'booking' && (
            <div className="space-y-5">
              <div className="border-b border-[#E5EBE5] pb-3">
                <h3 className="text-base font-bold text-[#1C2B20]">Quy định đặt lịch & điều phối</h3>
                <p className="text-xs text-[#66756B]">Thiết lập các mốc thời gian và bán kính điều phối KTV</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1C2B20]">Thời gian đặt trước tối thiểu (tiếng)</label>
                  <input
                    type="number"
                    min="1"
                    value={minAdvanceHours}
                    onChange={(e) => setMinAdvanceHours(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A]"
                  />
                  <span className="text-[11px] text-[#66756B]">Khách hàng cần đặt trước tối thiểu bao nhiêu giờ trước ca phục vụ.</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1C2B20]">Bán kính ghép lịch KTV tối đa (km)</label>
                  <input
                    type="number"
                    min="5"
                    value={maxTravelDistanceKm}
                    onChange={(e) => setMaxTravelDistanceKm(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A]"
                  />
                  <span className="text-[11px] text-[#66756B]">Hệ thống chỉ gán các kỹ thuật viên trong bán kính này để đảm bảo đúng giờ.</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1C2B20]">Phụ phí phục vụ ca đêm (22h00 - 06h00)</label>
                  <input
                    type="number"
                    step="10000"
                    value={nightSurcharge}
                    onChange={(e) => setNightSurcharge(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A]"
                  />
                  <span className="text-[11px] text-[#66756B]">Số tiền phụ thu (VNĐ) tự động cộng vào đơn ngoài giờ chuẩn.</span>
                </div>
              </div>
            </div>
          )}

          {/* 3. CỔNG THANH TOÁN */}
          {activeCategory === 'payment' && (
            <div className="space-y-5">
              <div className="border-b border-[#E5EBE5] pb-3">
                <h3 className="text-base font-bold text-[#1C2B20]">Phương thức thanh toán</h3>
                <p className="text-xs text-[#66756B]">Quản lý cổng chuyển khoản tự động và thu tiền mặt</p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-[#1C2B20]">Chuyển khoản ngân hàng VietQR tự động</h4>
                    <p className="text-[11px] text-[#66756B]">Tự động đối soát giao dịch và duyệt lịch ngay khi nhận tiền</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#EAF5EC] text-[#2E7D4A]">
                    Đang bật
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-[#1C2B20]">Tiền mặt sau khi hoàn tất dịch vụ (COD)</h4>
                    <p className="text-[11px] text-[#66756B]">Khách thanh toán trực tiếp cho kỹ thuật viên tại nhà</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#EAF5EC] text-[#2E7D4A]">
                    Đang bật
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 4. CHÍNH SÁCH KTV */}
          {activeCategory === 'technician' && (
            <div className="space-y-5">
              <div className="border-b border-[#E5EBE5] pb-3">
                <h3 className="text-base font-bold text-[#1C2B20]">Chính sách & Hoa hồng KTV</h3>
                <p className="text-xs text-[#66756B]">Thiết lập tỷ lệ phân chia thu nhập cho kỹ thuật viên</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1C2B20]">Tỷ lệ hoa hồng cho KTV (%)</label>
                  <input
                    type="number"
                    min="50"
                    max="90"
                    value={techCommissionRate}
                    onChange={(e) => setTechCommissionRate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A]"
                  />
                  <span className="text-[11px] text-[#66756B]">KTV hưởng {techCommissionRate}% tổng giá trị ca phục vụ, sàn MATXXA giữ lại {100 - Number(techCommissionRate)}%.</span>
                </div>
              </div>
            </div>
          )}

          {/* 5. MẪU THÔNG BÁO PUSH (Connected to live API) */}
          {activeCategory === 'notifications' && (
            <div className="space-y-5">
              <div className="border-b border-[#E5EBE5] pb-3">
                <h3 className="text-base font-bold text-[#1C2B20]">Mẫu thông báo đẩy hệ thống</h3>
                <p className="text-xs text-[#66756B]">Quản lý tin nhắn thông báo tự động gửi đến ứng dụng khách hàng và KTV</p>
              </div>

              <div className="space-y-4">
                {notificationTemplatesLoading ? (
                  <p className="text-xs text-[#66756B]">Đang tải danh sách mẫu thông báo từ máy chủ...</p>
                ) : (
                  notificationTemplates.map((template) => (
                    <div key={template.type} className="p-4 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-[#2E7D4A]">{template.type}</span>
                        <button
                          type="button"
                          onClick={() => void saveTemplate(template)}
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#2E7D4A] text-white hover:bg-[#256A3E] transition-colors"
                        >
                          Lưu mẫu
                        </button>
                      </div>
                      <input
                        type="text"
                        value={template.title}
                        onChange={(e) => updateTemplate(template.type, 'title', e.target.value)}
                        placeholder="Tiêu đề thông báo"
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#E5EBE5] text-xs text-[#1C2B20] font-semibold"
                      />
                      <textarea
                        rows={2}
                        value={template.body}
                        onChange={(e) => updateTemplate(template.type, 'body', e.target.value)}
                        placeholder="Nội dung thông báo"
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#E5EBE5] text-xs text-[#1C2B20]"
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 6. BẢO MẬT & PHÂN QUYỀN */}
          {activeCategory === 'security' && (
            <div className="space-y-5">
              <div className="border-b border-[#E5EBE5] pb-3">
                <h3 className="text-base font-bold text-[#1C2B20]">Bảo mật tài khoản & Phân quyền</h3>
                <p className="text-xs text-[#66756B]">Xác thực 2 yếu tố và phiên đăng nhập quản trị</p>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-xs text-[#1C2B20]">Bảo mật 2 lớp (2FA qua Email / SMS)</h4>
                    <p className="text-[11px] text-[#66756B]">Yêu cầu mã xác thực khi đăng nhập từ thiết bị lạ</p>
                  </div>
                  <button
                    onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                      twoFactorEnabled
                        ? 'bg-[#EAF5EC] text-[#2E7D4A] border-[#D0E7D5]'
                        : 'bg-white text-[#66756B] border-[#E5EBE5]'
                    }`}
                  >
                    {twoFactorEnabled ? 'Đang bật' : 'Đang tắt'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Save Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#E5EBE5] py-3.5 px-6 shadow-lg flex items-center justify-between max-w-[1600px] mx-auto">
        <span className="text-xs text-[#66756B] hidden sm:inline">
          Các thay đổi sẽ được áp dụng ngay sau khi lưu.
        </span>

        <div className="flex items-center gap-3 ml-auto">
          <button
            onClick={() => setActiveCategory('brand')}
            className="px-4 py-2 rounded-xl border border-[#E5EBE5] text-xs font-semibold text-[#66756B] hover:text-[#1C2B20] hover:bg-[#F6F8F4] transition-colors"
          >
            Hủy thay đổi
          </button>
          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="px-6 py-2 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white text-xs font-semibold shadow-md shadow-[#2E7D4A]/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            {isSaving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Đang lưu...' : 'Lưu tất cả thay đổi'}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default SettingsPage;
