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
  Receipt,
} from 'lucide-react';
import { useToast } from '../components/ui/ToastContainer';
import { request } from '../api/client';
import { Button } from '../components/ui/kit';
import { PageHeader } from '../components/common/PageHeader';
import { SectionCard } from '../components/common/SectionCard';

type NotificationTemplate = { type: string; title: string; body: string; isActive: boolean };

const defaultNotificationTemplates: NotificationTemplate[] = [
  { type: 'BOOKING_CREATED', title: '[Thông báo Psyocore]', body: 'Khách mới đã đặt lịch. KTV vui lòng thu tiền trước khi làm.', isActive: true },
  { type: 'OPEN_BOOKING_AVAILABLE', title: 'Yêu cầu mới', body: 'Có đơn dịch vụ mới phù hợp. Hãy mở tab Nhận việc để xem và ứng tuyển.', isActive: true },
  { type: 'OPEN_BOOKING_REQUESTED', title: 'Khách đặt bạn', body: 'Khách hàng đã chọn bạn cho đơn dịch vụ mới. Hãy mở đơn để ứng tuyển hoặc từ chối.', isActive: true },
  { type: 'TECHNICIAN_SELECTED', title: '[Thông báo Psyocore]', body: 'Khách hàng đã chọn bạn cho đơn dịch vụ.', isActive: true },
  { type: 'BOOKING_CANCELLED', title: '[Thông báo Psyocore]', body: 'Lịch hẹn đã được hủy.', isActive: true },
  { type: 'BOOKING_EXPIRED', title: '[Thông báo Psyocore]', body: 'Đơn đã hết hạn.', isActive: true },
];

interface SettingsPageProps {
  theme: string;
  onToggleTheme: (t: string) => void;
  initialCategory?: SettingCategory;
}

type SettingCategory =
  | 'brand'
  | 'booking'
  | 'fees'
  | 'payment'
  | 'technician'
  | 'notifications'
  | 'security';


const SERVICE_MODE_OPTIONS = [
  { value: 'HOME', label: 'Phục vụ tận nơi' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'ONSITE', label: 'Cơ sở' },
];

export const SettingsPage: React.FC<SettingsPageProps> = ({ theme, onToggleTheme, initialCategory = 'brand' }) => {
  const { addToast } = useToast();
  const [activeCategory, setActiveCategory] = useState<SettingCategory>(initialCategory);
  const [notificationTemplates, setNotificationTemplates] = useState<NotificationTemplate[]>([]);
  const [notificationTemplatesLoading, setNotificationTemplatesLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Settings State
  const [brandName, setBrandName] = useState('');
  const [brandHotline, setBrandHotline] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [minAdvanceHours, setMinAdvanceHours] = useState('0');
  const [maxTravelDistanceKm, setMaxTravelDistanceKm] = useState('0');
  const [travelFeeThresholdKm, setTravelFeeThresholdKm] = useState('10');
  const [travelFeeAmount, setTravelFeeAmount] = useState('0');
  const [confirmationWaitMinutes, setConfirmationWaitMinutes] = useState('10');
  const [requireTechnicianPhone, setRequireTechnicianPhone] = useState(false);
  const [enabledServiceModes, setEnabledServiceModes] = useState<string[]>(['HOME', 'ONLINE', 'ONSITE']);
  const [homeServiceFee, setHomeServiceFee] = useState('100000');
  const [techCommissionRate, setTechCommissionRate] = useState('75');
  const [dailyDiscountThreshold, setDailyDiscountThreshold] = useState('0');
  const [dailyDiscountFeePercent, setDailyDiscountFeePercent] = useState('20');
  const [cancelLimitCount, setCancelLimitCount] = useState('3');
  const [cancelLimitWindowHours, setCancelLimitWindowHours] = useState('24');
  const [suspensionHours, setSuspensionHours] = useState<string[]>(['3', '24', '168']);
  const [suspensionResetDays, setSuspensionResetDays] = useState('30');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);

  React.useEffect(() => {
    void request<NotificationTemplate[]>('/admin/notifications/templates')
      .then(setNotificationTemplates)
      .catch(() => setNotificationTemplates(defaultNotificationTemplates))
      .finally(() => setNotificationTemplatesLoading(false));
  }, []);

  React.useEffect(() => {
    void request<{ technicianSharePercent: number }>('/admin/settings/commission')
      .then((value) => setTechCommissionRate(String(value.technicianSharePercent)))
      .catch(() => undefined);
    void request<{ brandName: string; hotline: string; supportEmail: string }>('/admin/settings/platform')
      .then((value) => {
        setBrandName(value.brandName);
        setBrandHotline(value.hotline);
        setSupportEmail(value.supportEmail);
      })
      .catch(() => undefined);
    void request<{ minAdvanceHours: number; maxDispatchRadiusKm: number; travelFeeThresholdKm: number; travelFeeAmount: number; confirmationWaitMinutes: number; requireTechnicianPhone: boolean; homeServiceFee: number; dailyDiscountThreshold: number; dailyDiscountFeePercent: number; enabledServiceModes?: string[]; cancelLimitCount?: number; cancelLimitWindowHours?: number; suspensionHours?: number[]; suspensionResetDays?: number }>('/admin/settings/booking')
      .then((value) => {
        setMinAdvanceHours(String(value.minAdvanceHours));
        setMaxTravelDistanceKm(String(value.maxDispatchRadiusKm));
        setTravelFeeThresholdKm(String(value.travelFeeThresholdKm ?? 10));
        setTravelFeeAmount(String(value.travelFeeAmount ?? 0));
        setConfirmationWaitMinutes(String(value.confirmationWaitMinutes ?? 10));
        setRequireTechnicianPhone(Boolean(value.requireTechnicianPhone));
        if (value.enabledServiceModes?.length) setEnabledServiceModes(value.enabledServiceModes);
        setHomeServiceFee(String(value.homeServiceFee ?? 100000));
        setDailyDiscountThreshold(String(value.dailyDiscountThreshold ?? 0));
        setDailyDiscountFeePercent(String(value.dailyDiscountFeePercent ?? 20));
        setCancelLimitCount(String(value.cancelLimitCount ?? 3));
        setCancelLimitWindowHours(String(value.cancelLimitWindowHours ?? 24));
        // Always three levels on screen (1st, 2nd, 3rd and later).
        const levels = value.suspensionHours?.length ? value.suspensionHours : [3, 24, 168];
        setSuspensionHours([0, 1, 2].map((i) => String(levels[Math.min(i, levels.length - 1)])));
        setSuspensionResetDays(String(value.suspensionResetDays ?? 30));
      })
      .catch(() => undefined);
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

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      if (activeCategory === 'technician') {
        const share = Number(techCommissionRate);
        if (!Number.isInteger(share) || share < 0 || share > 100) throw new Error('Tỷ lệ KTV nhận phải là số nguyên từ 0 đến 100 (ví dụ 80)');
        const threshold = Number(dailyDiscountThreshold);
        const discounted = Number(dailyDiscountFeePercent);
        if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100) throw new Error('Số đơn/ngày phải là số nguyên từ 0 đến 100');
        if (!Number.isInteger(discounted) || discounted < 0 || discounted > 100) throw new Error('Phí chiết khấu sau mốc phải là số nguyên từ 0 đến 100');
        await request('/admin/settings/commission', { method: 'PATCH', body: JSON.stringify({ technicianSharePercent: share }) });
        await request('/admin/settings/booking', { method: 'PATCH', body: JSON.stringify({ dailyDiscountThreshold: threshold, dailyDiscountFeePercent: discounted }) });
        addToast({ title: 'Đã lưu chính sách KTV', message: `KTV nhận ${techCommissionRate}% giá trị dịch vụ.`, type: 'success' });
      }
      if (activeCategory === 'brand') {
        if (!brandName.trim()) throw new Error('Tên thương hiệu không được để trống');
        await request('/admin/settings/platform', {
          method: 'PATCH',
          body: JSON.stringify({ brandName: brandName.trim(), hotline: brandHotline.trim(), supportEmail: supportEmail.trim() }),
        });
        addToast({ title: 'Đã lưu thông tin hệ thống', type: 'success' });
      }
      if (activeCategory === 'booking') {
        const hours = Number(minAdvanceHours);
        const radius = Number(maxTravelDistanceKm);
        if (!Number.isInteger(hours) || hours < 0 || hours > 72) throw new Error('Thời gian đặt trước phải là số nguyên từ 0 đến 72 giờ');
        if (!Number.isInteger(radius) || radius < 0 || radius > 200) throw new Error('Bán kính phải là số nguyên từ 0 đến 200 km');
        const wait = Number(confirmationWaitMinutes);
        if (!Number.isInteger(wait) || wait < 1 || wait > 60) throw new Error('Thời gian chờ KTV xác nhận phải từ 1 đến 60 phút');
        if (!enabledServiceModes.length) throw new Error('Phải bật ít nhất 1 nơi phục vụ');
        const limitCount = Number(cancelLimitCount);
        const limitWindow = Number(cancelLimitWindowHours);
        const levels = suspensionHours.map(Number);
        const resetDays = Number(suspensionResetDays);
        if (!Number.isInteger(limitCount) || limitCount < 0 || limitCount > 50) throw new Error('Số lần hủy phải là số nguyên từ 0 đến 50');
        if (!Number.isInteger(limitWindow) || limitWindow < 1 || limitWindow > 720) throw new Error('Khoảng thời gian đếm phải từ 1 đến 720 giờ');
        if (levels.some((level) => !Number.isInteger(level) || level < 1 || level > 8760)) throw new Error('Thời gian tạm khóa mỗi lần phải từ 1 đến 8760 giờ');
        if (!Number.isInteger(resetDays) || resetDays < 1 || resetDays > 365) throw new Error('Số ngày tính lại từ lần 1 phải từ 1 đến 365');
        await request('/admin/settings/booking', {
          method: 'PATCH',
          body: JSON.stringify({
            minAdvanceHours: hours, maxDispatchRadiusKm: radius, confirmationWaitMinutes: wait, requireTechnicianPhone, enabledServiceModes,
            cancelLimitCount: limitCount, cancelLimitWindowHours: limitWindow, suspensionHours: levels, suspensionResetDays: resetDays,
          }),
        });
        addToast({ title: 'Đã lưu quy định đặt lịch', message: 'Áp dụng cho các đơn đặt sau khi lưu.', type: 'success' });
      }
      if (activeCategory === 'fees') {
        const surcharge = Number(homeServiceFee);
        if (!Number.isInteger(surcharge) || surcharge < 0 || surcharge > 5_000_000) throw new Error('Phụ phí phải là số nguyên từ 0 đến 5.000.000đ');
        const feeKm = Number(travelFeeThresholdKm);
        const fee = Number(travelFeeAmount);
        if (!Number.isInteger(feeKm) || feeKm < 0 || feeKm > 200) throw new Error('Ngưỡng tính phí di chuyển phải là số nguyên từ 0 đến 200 km');
        if (!Number.isInteger(fee) || fee < 0 || fee > 5_000_000) throw new Error('Phí di chuyển phải là số nguyên từ 0 đến 5.000.000đ');
        await request('/admin/settings/booking', {
          method: 'PATCH',
          body: JSON.stringify({ homeServiceFee: surcharge, travelFeeThresholdKm: feeKm, travelFeeAmount: fee }),
        });
        addToast({ title: 'Đã lưu phụ phí', message: `Phụ phí đơn tại nhà: ${surcharge.toLocaleString('vi-VN')}đ. Áp dụng cho đơn đặt sau khi lưu.`, type: 'success' });
      }
      setIsSaving(false);
    } catch (error) {
      setIsSaving(false);
      addToast({ title: 'Không thể lưu thay đổi', message: error instanceof Error ? error.message : 'Vui lòng thử lại', type: 'error' });
    }
  };

  // Only these categories are stored on the server. The rest are layout only for now,
  // so they are read-only and never report a successful save.
  const SAVED_ON_SERVER: SettingCategory[] = ['brand', 'booking', 'fees', 'technician', 'notifications'];
  const SAVE_BAR: Partial<Record<SettingCategory, { label: string; hint: string }>> = {
    brand: { label: 'Lưu thông tin hệ thống', hint: 'Hiển thị trên ứng dụng khách hàng và KTV.' },
    booking: { label: 'Lưu quy định đặt lịch', hint: 'Áp dụng cho các đơn đặt sau khi lưu.' },
    fees: { label: 'Lưu phụ phí', hint: 'Áp dụng cho các đơn đặt sau khi lưu.' },
    technician: { label: 'Lưu chính sách KTV', hint: 'Tỷ lệ mới áp dụng cho các đơn được nhận sau khi lưu.' },
  };
  const saveBar = SAVE_BAR[activeCategory];
  const persisted = SAVED_ON_SERVER.includes(activeCategory);

  const categories = [
    { id: 'brand', label: 'Thông tin hệ thống', icon: Store, desc: 'Tên thương hiệu, hotline, email CSKH' },
    { id: 'fees', label: 'Phụ phí & Phí di chuyển', icon: Receipt, desc: `Phụ phí đơn tại nhà: ${Number(homeServiceFee || 0).toLocaleString('vi-VN')}đ` },
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
                  <div className="text-xs font-bold text-[#1C2B20] flex items-center gap-1.5 flex-wrap">
                    {cat.label}
                    {!SAVED_ON_SERVER.includes(cat.id as SettingCategory) && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#FEF6E9] text-[#A86A0C] text-[9px] font-semibold">Chưa lưu được</span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#66756B] mt-0.5">{cat.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Form Settings */}
        <div className="md:col-span-8 bg-white rounded-2xl border border-[#E5EBE5] p-6 shadow-2xs space-y-6">
          {!persisted && (
            <div role="note" className="p-3 rounded-xl bg-[#FEF6E9] border border-[#FBE3B8] text-xs text-[#A86A0C] leading-relaxed">
              Mục này chưa được kết nối máy chủ nên chỉ để xem, chưa chỉnh sửa và lưu được. Các giá trị hiển thị là mặc định của giao diện, không phải cấu hình thật.
            </div>
          )}
          <fieldset disabled={!persisted} className="space-y-6 min-w-0 disabled:opacity-70">
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
                  <span className="text-[11px] text-[#66756B]">Tên hiển thị chính thức của hệ thống đặt massage &amp; spa.</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#1C2B20]">Hotline tổng đài CSKH</label>
                    <input
                      type="tel"
                      maxLength={20}
                      placeholder="vd: 0901 234 567"
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
                      placeholder="vd: hello.psyocore@gmail.com"
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
                    min="0"
                    max="72"
                    value={minAdvanceHours}
                    onChange={(e) => setMinAdvanceHours(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A]"
                  />
                  <span className="text-[11px] text-[#66756B]">Khách phải đặt trước ca phục vụ ít nhất bao nhiêu giờ. Nhập 0 để không giới hạn.</span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#1C2B20]">Nơi phục vụ đang mở</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {SERVICE_MODE_OPTIONS.map((option) => {
                      const on = enabledServiceModes.includes(option.value);
                      return (
                        <label
                          key={option.value}
                          className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer ${on ? 'bg-[#EAF5EC] border-[#2E7D4A]' : 'bg-[#F6F8F4] border-[#E5EBE5]'}`}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={(e) =>
                              setEnabledServiceModes((current) =>
                                e.target.checked ? [...current, option.value] : current.filter((mode) => mode !== option.value),
                              )
                            }
                            className="mt-0.5 w-4 h-4 accent-[#2E7D4A]"
                          />
                          <span>
                            <span className="block text-xs font-bold text-[#1C2B20]">{option.label}</span>
                            <span className="block text-[11px] text-[#66756B]">{on ? 'Đang mở' : 'Đang tắt'}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <span className="text-[11px] text-[#66756B]">
                    Tắt một mục thì app ẩn lựa chọn đó khi khách đặt lịch và khi KTV đăng ký, khách không đặt được hình thức đó nữa.
                    KTV đã chọn từ trước vẫn giữ nguyên trong hồ sơ, đơn đã đặt vẫn làm bình thường. Phải mở ít nhất 1 mục.
                  </span>
                </div>

                <label className="flex items-start gap-3 p-3.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireTechnicianPhone}
                    onChange={(e) => setRequireTechnicianPhone(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#2E7D4A]"
                  />
                  <span>
                    <span className="block text-xs font-bold text-[#1C2B20]">Bắt buộc KTV có số điện thoại để nhận đơn</span>
                    <span className="block text-[11px] text-[#66756B]">
                      Chỉ bật khi app đã có màn nhập số điện thoại. Bật thì KTV đăng nhập bằng Google/Apple/email chưa thêm số sẽ không nhận được đơn.
                    </span>
                  </span>
                </label>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1C2B20]">Thời gian chờ KTV xác nhận (phút)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={confirmationWaitMinutes}
                    onChange={(e) => setConfirmationWaitMinutes(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A]"
                  />
                  <span className="text-[11px] text-[#66756B]">Đơn mới chờ KTV nhận trong bấy nhiêu phút, quá thời gian thì đơn hết hạn. Áp dụng cho đơn đặt sau khi lưu.</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1C2B20]">Bán kính ghép lịch KTV tối đa (km)</label>
                  <input
                    type="number"
                    min="0"
                    max="200"
                    value={maxTravelDistanceKm}
                    onChange={(e) => setMaxTravelDistanceKm(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A]"
                  />
                  <span className="text-[11px] text-[#66756B]">
                    Đơn tại nhà chỉ gợi ý và gửi cho KTV trong bán kính này tính từ địa chỉ khách. KTV chưa cập nhật vị trí vẫn nhận được. Nhập 0 để không giới hạn.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#1C2B20]">Hủy quá (số đơn)</label>
                    <input type="number" min="0" max="50" value={cancelLimitCount} onChange={(e) => setCancelLimitCount(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A]" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#1C2B20]">Trong vòng (giờ)</label>
                    <input type="number" min="1" max="720" value={cancelLimitWindowHours} onChange={(e) => setCancelLimitWindowHours(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A]" />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {suspensionHours.map((value, index) => (
                    <div key={index} className="space-y-1">
                      <label className="text-xs font-bold text-[#1C2B20]">Tạm khóa lần {index + 1} (giờ)</label>
                      <input
                        type="number" min="1" max="8760" value={value}
                        onChange={(e) => setSuspensionHours((current) => current.map((item, i) => (i === index ? e.target.value : item)))}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A]"
                      />
                    </div>
                  ))}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#1C2B20]">Về lại lần 1 sau (ngày)</label>
                    <input type="number" min="1" max="365" value={suspensionResetDays} onChange={(e) => setSuspensionResetDays(e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A]" />
                  </div>
                  <span className="col-span-2 sm:col-span-4 text-[11px] text-[#66756B]">
                    {Number(cancelLimitCount) > 0
                      ? `Khách hoặc KTV hủy ${cancelLimitCount} đơn đã có KTV nhận trong ${cancelLimitWindowHours} giờ thì tự bị tạm khóa: lần 1 ${suspensionHours[0]} giờ, tái phạm lần 2 ${suspensionHours[1]} giờ, lần 3 trở đi ${suspensionHours[2]} giờ (và hiện "cần xem xét" để admin cân nhắc khóa vĩnh viễn). ${suspensionResetDays} ngày không bị tạm khóa thì tính lại từ lần 1. `
                      : 'Nhập 0 để tắt tự tạm khóa khi hủy nhiều (admin vẫn tạm khóa tay được theo các mức trên). '}
                    Tạm khóa: vẫn đăng nhập, xem lịch sử, chat, rút ví; không đặt đơn mới (khách) / nhận đơn mới (KTV); hết giờ tự mở. App cảnh báo khi còn 1 lần hủy.
                    Không tính: hủy đơn chưa có KTV nhận, đơn tự hết hạn, admin hủy, KTV hủy có ảnh bằng chứng (khách vắng mặt, không an toàn…), danh mục đã tắt "Tính phạt khi hủy".
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* PHỤ PHÍ & PHÍ DI CHUYỂN */}
          {activeCategory === 'fees' && (
            <div className="space-y-5">
              <div className="border-b border-[#E5EBE5] pb-3">
                <h3 className="text-base font-bold text-[#1C2B20]">Phụ phí & Phí di chuyển</h3>
                <p className="text-xs text-[#66756B]">Các khoản cộng thêm vào tiền khách trả, hiện ở màn thanh toán của khách</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-[#EAF5EC] border border-[#CFE6D5]">
                  <div className="text-[11px] font-semibold text-[#2E7D4A]">Phụ phí đơn tại nhà</div>
                  <div className="text-2xl font-bold text-[#1C2B20] mt-1">
                    {Number(homeServiceFee) > 0 ? `${Number(homeServiceFee).toLocaleString('vi-VN')}đ` : 'Không thu'}
                  </div>
                  <div className="text-[11px] text-[#66756B] mt-1">Cộng vào mọi đơn tại nhà</div>
                </div>
                <div className="p-4 rounded-2xl bg-[#F6F8F4] border border-[#E5EBE5]">
                  <div className="text-[11px] font-semibold text-[#66756B]">Phí di chuyển</div>
                  <div className="text-2xl font-bold text-[#1C2B20] mt-1">
                    {Number(travelFeeAmount) > 0 ? `${Number(travelFeeAmount).toLocaleString('vi-VN')}đ` : 'Đang tắt'}
                  </div>
                  <div className="text-[11px] text-[#66756B] mt-1">
                    {Number(travelFeeAmount) > 0 ? `Khi khách xa KTV hơn ${travelFeeThresholdKm} km, KTV nhận 100%` : 'Nhập số tiền bên dưới để bật'}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#1C2B20]">Phụ phí đơn tại nhà (đ)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={homeServiceFee}
                    onChange={(e) => setHomeServiceFee(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A]"
                  />
                  <span className="text-[11px] text-[#66756B]">
                    Dòng "Phụ phí" ở màn thanh toán của khách: cộng vào mọi đơn tại nhà, không áp dụng đơn tại cơ sở. Nhập 0 để không thu. Áp dụng cho đơn đặt sau khi lưu.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#1C2B20]">Tính phí di chuyển khi xa hơn (km)</label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={travelFeeThresholdKm}
                      onChange={(e) => setTravelFeeThresholdKm(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#1C2B20]">Phí di chuyển (đ)</label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={travelFeeAmount}
                      onChange={(e) => setTravelFeeAmount(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A]"
                    />
                  </div>
                  <span className="sm:col-span-2 text-[11px] text-[#66756B]">
                    Đơn tại nhà có khoảng cách khách–KTV vượt ngưỡng sẽ cộng một khoản cố định này vào tổng tiền khi chốt KTV.
                    KTV nhận 100%, không tính hoa hồng. Không biết vị trí KTV thì không tính. Nhập phí 0 để tắt.
                  </span>
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
                  <label className="text-xs font-bold text-[#1C2B20]">KTV nhận (% giá dịch vụ)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={techCommissionRate}
                    onChange={(e) => setTechCommissionRate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A]"
                  />
                  <span className="text-[11px] text-[#66756B]">
                    KTV nhận {techCommissionRate}%, sàn Psyocore thu hoa hồng {100 - Number(techCommissionRate)}% (trừ vào ví KTV khi nhận đơn).
                    Ví dụ dịch vụ 500.000đ: sàn thu {(Math.round((500000 * (100 - Number(techCommissionRate))) / 100 / 1000) * 1000).toLocaleString('vi-VN')}đ.
                    Hoa hồng được làm tròn đến 1.000đ; phí di chuyển KTV nhận đủ, không tính hoa hồng.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#1C2B20]">Giảm chiết khấu khi KTV hoàn thành (đơn/ngày)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={dailyDiscountThreshold}
                      onChange={(e) => setDailyDiscountThreshold(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#1C2B20]">Phí chiết khấu sau mốc (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={dailyDiscountFeePercent}
                      onChange={(e) => setDailyDiscountFeePercent(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A]"
                    />
                  </div>
                  <span className="sm:col-span-2 text-[11px] text-[#66756B]">
                    {Number(dailyDiscountThreshold) > 0
                      ? `KTV đã hoàn thành ${dailyDiscountThreshold} đơn trong ngày thì các đơn nhận tiếp theo hôm đó chỉ bị trừ ${dailyDiscountFeePercent}% (thay vì ${100 - Number(techCommissionRate)}%). Các đơn trước mốc giữ nguyên phí. Tính theo giờ Việt Nam, sang ngày mới đếm lại.`
                      : 'Nhập 0 để tắt. Ví dụ 5 và 20: KTV làm xong 5 đơn trong ngày thì từ đơn tiếp theo chỉ bị trừ 20%.'}
                  </span>
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
          </fieldset>
        </div>
      </div>

      {/* Sticky Bottom Save Bar */}
      {saveBar && (
        <div className="sticky bottom-4 z-20 flex items-center justify-between gap-3 rounded-2xl bg-white/95 backdrop-blur-md border border-[#E5EBE5] py-3 px-5 shadow-lg">
          <span className="text-xs text-[#66756B] hidden sm:inline">{saveBar.hint}</span>
          <Button variant="primary" className="ml-auto" loading={isSaving} icon={<Save className="w-4 h-4" />} onClick={() => void handleSaveAll()}>
            {isSaving ? 'Đang lưu...' : saveBar.label}
          </Button>
        </div>
      )}
    </motion.div>
  );
};

export default SettingsPage;
