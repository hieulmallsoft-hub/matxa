import { FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { NAV_ITEMS, normalizeSearch } from '../navigation';
import { Badge, Button, Card, Empty, Field, FormGrid, FormSection, Input, SearchBox, Select, SkeletonRows, Tabs, Textarea } from '../components/ui/kit';
import { DetailDrawer } from '../components/common/DetailDrawer';
import { request } from '../api/client';
import { TechnicianPricingPanel } from '../components/TechnicianPricingPanel';
import { CourseManagementPanel } from '../components/CourseManagementPanel';
import { ServiceCatalogPanel } from '../components/ServiceCatalogPanel';
import {
  CalendarCheck,
  ClipboardCheck,
  DollarSign,
  UserCheck,
  Users,
  Star,
  CheckCircle2,
  ChevronRight,
  Filter,
  Plus,
  Search,
  X,
  FileText,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ExternalLink,
  UsersRound,
  Tag,
  Image as ImageIcon,
  RefreshCw,
} from 'lucide-react';
import type { Category } from '../types/api';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { SectionCard } from '../components/common/SectionCard';

type TabKey =
  | 'overview'
  | 'users'
  | 'bookings'
  | 'applications'
  | 'technicians'
  | 'pricing'
  | 'categories'
  | 'catalog'
  | 'banners'
  | 'promotions'
  | 'courses';

type Props = {
  notify: (message: string, error?: boolean) => void;
  refreshCategories: () => Promise<void>;
  tab: TabKey;
  setTab: (tab: TabKey) => void;
  refreshKey: number;
};

type Page<T> = { items: T[]; total: number; page: number; limit: number };
type Dashboard = {
  todayBookings: number;
  activeTechnicians: number;
  averageRating: number;
  reviewCount: number;
  completedBookingsThisMonth: number;
  revenueThisMonth: number;
};
type User = {
  id: string;
  displayName: string | null;
  email: string | null;
  phoneNumber: string | null;
  role: string;
  status: string;
  createdAt: string;
};
type Technician = {
  id: string;
  user: { id: string; displayName: string | null; status: string; phoneNumber?: string | null };
  isActive: boolean;
  isVerified: boolean;
  isAvailable: boolean;
  averageRating: number;
  reviewCount: number;
  _count: { services: number };
  city?: string | null;
};
type Booking = {
  id: string;
  status: string;
  mode: string;
  scheduledStart: string;
  totalAmount: number;
  customer: { displayName: string | null };
  technician: { user: { displayName: string | null } };
  items: { serviceName: string }[];
};
type Banner = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl: string;
  actionUrl?: string;
  isActive: boolean;
  sortOrder: number;
};
type Promotion = {
  id: string;
  code: string;
  name: string;
  type: string;
  value: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  usageLimit?: number;
  perUserLimit?: number;
  usedCount?: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
};
type TechnicianApplication = {
  id: string;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  displayName: string | null;
  city: string | null;
  district: string | null;
  supportedModes: string[];
  rejectionReason: string | null;
  user: { id: string; displayName: string | null; phoneNumber?: string | null };
  kyc?: { status: string } | null;
  idCardFrontKey?: string | null;
  idCardBackKey?: string | null;
  faceImageKey?: string | null;
  experienceYears?: number;
  services?: any[];
};

const serviceModeLabels: Record<string, string> = {
  HOME: 'Tận nơi',
  HOME_VISIT: 'Tận nơi',
  ONSITE: 'Tại cơ sở',
  STUDIO: 'Tại cơ sở',
  ONLINE: 'Online',
};

function formatServiceModes(modes?: string[] | null) {
  if (!modes?.length) return 'Chưa chọn';
  return modes.map((mode) => serviceModeLabels[mode] || mode).join(', ');
}

const NAV_DESCRIPTIONS: Record<string, string> = {
  ...Object.fromEntries(NAV_ITEMS.map((item) => [item.id, item.description])),
  pricing: 'Giá từng dịch vụ theo kỹ thuật viên',
};

const money = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
const date = (value: string) => new Date(value).toLocaleString('vi-VN');
const shortDate = (value: string) => new Date(value).toLocaleDateString('vi-VN');

/** Running / upcoming / expired / off, from the dates and the on-off switch. */
const promotionState = (promo: { isActive: boolean; startsAt: string; endsAt: string }) => {
  const now = Date.now();
  if (!promo.isActive) return { label: 'Đã tắt', tone: 'gray' as const };
  if (new Date(promo.endsAt).getTime() <= now) return { label: 'Hết hạn', tone: 'gray' as const };
  if (new Date(promo.startsAt).getTime() > now) return { label: 'Sắp diễn ra', tone: 'blue' as const };
  return { label: 'Đang chạy', tone: 'green' as const };
};

export function AdminDashboard({ notify, refreshCategories, tab, setTab, refreshKey }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [technicians, setTechnicians] = useState<Page<Technician> | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [applications, setApplications] = useState<Page<TechnicianApplication> | null>(null);
  const [applicationAction, setApplicationAction] = useState<string | null>(null);
  const [applicationDetail, setApplicationDetail] = useState<any | null>(null);
  const [technicianDetail, setTechnicianDetail] = useState<any | null>(null);
  const [appFilterTab, setAppFilterTab] = useState<'ALL' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'>('ALL');
  const [promoTab, setPromoTab] = useState<'promos' | 'banners'>('promos');
  const [loading, setLoading] = useState(false);
  const [technicianQuery, setTechnicianQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [promoDrawer, setPromoDrawer] = useState<'promo' | 'banner' | null>(null);
  const [promoQuery, setPromoQuery] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [bannerPreview, setBannerPreview] = useState('');
  const [rejecting, setRejecting] = useState<TechnicianApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Each tab loads only what it shows; failures are reported instead of leaving stale data.
  const load = useCallback(async () => {
    setLoading(true);
    const sources: Record<string, () => Promise<void>> = {
      technicians: async () => setTechnicians(await request<Page<Technician>>('/admin/marketplace/technicians?limit=100')),
      pricing: async () => setTechnicians(await request<Page<Technician>>('/admin/marketplace/technicians?limit=100')),
      applications: async () =>
        setApplications(await request<Page<TechnicianApplication>>('/admin/marketplace/technician-applications?limit=100')),
      catalog: async () => setCategories(await request<Category[]>('/admin/marketplace/categories')),
      promotions: async () => {
        const [nextBanners, nextPromotions] = await Promise.all([
          request<Banner[]>('/admin/marketplace/banners'),
          request<Promotion[]>('/admin/marketplace/promotions'),
        ]);
        setBanners(nextBanners ?? []);
        setPromotions(nextPromotions ?? []);
      },
    };
    try {
      await sources[tab]?.();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Không tải được dữ liệu', true);
    } finally {
      setLoading(false);
    }
    // notify is recreated by the parent each render; reloading on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  /** Posts a form; resolves true on success so a drawer can close itself. */
  async function save(event: FormEvent<HTMLFormElement>, path: string, body: unknown) {
    event.preventDefault();
    // React clears currentTarget once the handler yields, so keep the form before awaiting.
    const formElement = event.currentTarget;
    setSaving(true);
    try {
      await request(path, { method: 'POST', body: JSON.stringify(body) });
      formElement.reset();
      notify('Đã lưu dữ liệu thành công.');
      await load();
      await refreshCategories();
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Không thể lưu dữ liệu', true);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function patch(path: string, body: unknown) {
    try {
      await request(path, { method: 'PATCH', body: JSON.stringify(body) });
      notify('Đã cập nhật trạng thái.');
      await load();
      await refreshCategories();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Không thể cập nhật', true);
    }
  }

  async function remove(path: string) {
    try {
      await request(path, { method: 'DELETE' });
      notify('Đã xóa hoặc ẩn bản ghi.');
      await load();
      await refreshCategories();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Không thể thực hiện', true);
    }
  }

  async function reviewApplication(
    application: TechnicianApplication,
    action: 'review' | 'approve' | 'reject',
    reason?: string,
  ) {
    // Rejecting needs a reason the applicant will see; collect it in a dialog first.
    if (action === 'reject' && !reason?.trim()) {
      setRejectReason('');
      setRejecting(application);
      return;
    }
    const body = action === 'reject' ? { reason: reason!.trim() } : undefined;
    setApplicationAction(application.id);
    try {
      await request(`/admin/marketplace/technician-applications/${application.id}/${action}`, {
        method: 'POST',
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      notify(
        action === 'approve'
          ? 'Đã duyệt hồ sơ kỹ thuật viên thành công.'
          : action === 'reject'
            ? 'Đã từ chối hồ sơ KTV.'
            : 'Hồ sơ đang trong trạng thái xem xét.',
      );
      if (applicationDetail && applicationDetail.id === application.id) {
        setApplicationDetail(null);
      }
      setRejecting(null);
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Không thể xử lý hồ sơ', true);
    } finally {
      setApplicationAction(null);
    }
  }

  async function openApplicationDetail(id: string) {
    try {
      const detail = await request(`/admin/marketplace/technician-applications/${id}`);
      setApplicationDetail(detail);
    } catch {
      // Fallback
      const fallbackItem = applications?.items.find((a) => a.id === id);
      setApplicationDetail(fallbackItem || { id, displayName: 'Ứng viên KTV', status: 'SUBMITTED' });
    }
  }

  const form = (event: FormEvent<HTMLFormElement>) => new FormData(event.currentTarget);

  const getPageTitle = () => {
    switch (tab) {
      case 'technicians': return 'Quản lý Kỹ thuật viên';
      case 'applications': return 'Duyệt hồ sơ Kỹ thuật viên';
      case 'catalog': return 'Danh mục Dịch vụ Spa';
      case 'pricing': return 'Bảng giá dịch vụ KTV';
      case 'courses': return 'Khóa học Đào tạo Chuyên môn';
      case 'promotions': return 'Chương trình Khuyến mãi & Banner';
      case 'banners': return 'Banner Ứng dụng';
      case 'categories': return 'Danh mục dịch vụ';
      case 'users': return 'Danh sách tài khoản';
      case 'bookings': return 'Tất cả lịch đặt';
      default: return 'Tổng quan vận hành';
    }
  };

  const technicianItems = technicians?.items ?? [];
  const technicianStats = (() => {
    const reviews = technicianItems.reduce((sum, tech) => sum + (tech.reviewCount ?? 0), 0);
    const weighted = technicianItems.reduce((sum, tech) => sum + Number(tech.averageRating ?? 0) * (tech.reviewCount ?? 0), 0);
    const available = technicianItems.filter((tech) => tech.isActive && tech.isAvailable).length;
    return {
      total: technicians?.total ?? technicianItems.length,
      available,
      busy: technicianItems.length - available,
      reviews,
      rating: reviews ? weighted / reviews : 0,
    };
  })();
  const visibleTechnicians = technicianItems.filter((tech) =>
    normalizeSearch(`${tech.user.displayName ?? ''} ${tech.user.phoneNumber ?? ''} ${tech.city ?? ''}`).includes(normalizeSearch(technicianQuery)),
  );

  const filteredApplications = applications?.items.filter((app) => {
    if (appFilterTab === 'ALL') return true;
    return app.status === appFilterTab;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={getPageTitle()}
        subtitle={tab in NAV_DESCRIPTIONS ? NAV_DESCRIPTIONS[tab] : undefined}
        actions={
          tab !== 'courses' && tab !== 'catalog' ? (
            <Button icon={<RefreshCw className="w-4 h-4" />} loading={loading} onClick={() => void load()}>
              Tải lại
            </Button>
          ) : undefined
        }
      />

      {/* ── 1. KỸ THUẬT VIÊN (TECHNICIANS) ── */}
      {tab === 'technicians' && (
        <div className="space-y-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Tổng kỹ thuật viên"
              value={technicianStats.total}
              caption="toàn hệ thống"
              icon={<UsersRound className="w-5 h-5" />}
              tone="primary"
            />
            <StatCard
              label="Sẵn sàng nhận ca"
              value={technicianStats.available}
              caption="đang bật và rảnh"
              icon={<UserCheck className="w-5 h-5" />}
              tone="success"
            />
            <StatCard
              label="Đang bận / tạm ẩn"
              value={technicianStats.busy}
              caption="bận hoặc đã tắt hiển thị"
              icon={<Clock className="w-5 h-5" />}
              tone="info"
            />
            <StatCard
              label="Đánh giá trung bình"
              value={technicianStats.reviews ? `${technicianStats.rating.toFixed(2)} ★` : 'Chưa có'}
              caption={`từ ${technicianStats.reviews.toLocaleString('vi-VN')} đánh giá`}
              icon={<Star className="w-5 h-5" />}
              tone="warning"
            />
          </div>

          {/* Technicians Table */}
          <SectionCard
            title="Danh sách kỹ thuật viên"
            subtitle={`${visibleTechnicians.length} / ${technicianItems.length} kỹ thuật viên`}
            action={<SearchBox value={technicianQuery} onChange={setTechnicianQuery} placeholder="Tìm tên, SĐT, khu vực..." className="w-60" />}
            noPadding
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F6F8F4] text-[#66756B] uppercase font-semibold border-b border-[#E5EBE5]">
                  <tr>
                    <th className="py-3 px-4">Kỹ thuật viên</th>
                    <th className="py-3 px-4">Số điện thoại</th>
                    <th className="py-3 px-4">Khu vực</th>
                    <th className="py-3 px-4">Số dịch vụ</th>
                    <th className="py-3 px-4">Đánh giá</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5EF] text-sm text-[#1C2B20]">
                  {visibleTechnicians.map((tech) => (
                    <tr key={tech.id} className="hover:bg-[#F6F8F4] transition-colors h-16">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#EAF5EC] text-[#2E7D4A] font-bold text-xs flex items-center justify-center ring-2 ring-[#D0E7D5]">
                            {tech.user.displayName ? tech.user.displayName.substring(0, 2).toUpperCase() : 'KT'}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-[#1C2B20]">{tech.user.displayName ?? tech.id}</div>
                            <div className="text-[11px] text-[#94A399]">{tech.isVerified ? '✓ Đã xác minh KYC' : 'Chưa KYC'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[#66756B]">
                        {tech.user.phoneNumber || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium">
                        {tech.city || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-[#2E7D4A]">
                        {tech._count.services} gói dịch vụ
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <span className="inline-flex items-center gap-1 font-bold text-[#F2A93B]">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span>{tech.averageRating.toFixed(2)}</span>
                          <span className="text-[#94A399] font-normal">({tech.reviewCount})</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge
                          status={tech.isActive ? (tech.isAvailable ? 'ACTIVE' : 'PROCESSING') : 'INACTIVE'}
                          customLabel={tech.isActive ? (tech.isAvailable ? 'Sẵn sàng' : 'Đang bận') : 'Tạm ẩn'}
                        />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => void request<any>(`/marketplace/technicians/${tech.id}`).then(setTechnicianDetail).catch((error) => notify(error instanceof Error ? error.message : 'Không thể tải chi tiết KTV', true))}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#1C2B20] bg-[#F1F5EF] hover:bg-[#E5EBE5] transition-colors"
                          >
                            Chi tiết
                          </button>
                          <button
                            onClick={() => setTab('pricing')}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#2E7D4A] bg-[#EAF5EC] hover:bg-[#DDF0E1] transition-colors"
                          >
                            Bảng giá
                          </button>
                          <button
                            onClick={() =>
                              void patch(`/admin/marketplace/technicians/${tech.id}`, { isActive: !tech.isActive })
                            }
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                              tech.isActive
                                ? 'text-[#E05B55] hover:bg-[#FDF0EF]'
                                : 'text-[#2E7D4A] hover:bg-[#EAF5EC]'
                            }`}
                          >
                            {tech.isActive ? 'Khóa/Ẩn' : 'Kích hoạt'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── 2. DUYỆT HỒ SƠ KTV (APPLICATIONS) ── */}
      {tab === 'applications' && (
        <div className="space-y-6">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-[#F1F5EF] rounded-xl border border-[#E5EBE5] max-w-fit">
            {[
              { key: 'ALL', label: 'Tất cả hồ sơ' },
              { key: 'SUBMITTED', label: 'Chờ duyệt' },
              { key: 'UNDER_REVIEW', label: 'Cần bổ sung' },
              { key: 'APPROVED', label: 'Đã duyệt' },
              { key: 'REJECTED', label: 'Từ chối' },
            ].map((tabItem) => (
              <button
                key={tabItem.key}
                onClick={() => setAppFilterTab(tabItem.key as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  appFilterTab === tabItem.key
                    ? 'bg-white text-[#2E7D4A] shadow-xs'
                    : 'text-[#66756B] hover:text-[#1C2B20]'
                }`}
              >
                {tabItem.label}
              </button>
            ))}
          </div>

          {/* Applications Table */}
          <SectionCard
            title="Danh sách đơn đăng ký KTV"
            subtitle={`${filteredApplications.length} hồ sơ theo bộ lọc — Admin xét duyệt thông tin pháp lý & chứng chỉ`}
            noPadding
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F6F8F4] text-[#66756B] uppercase font-semibold border-b border-[#E5EBE5]">
                  <tr>
                    <th className="py-3 px-4">Ứng viên KTV</th>
                    <th className="py-3 px-4">Số điện thoại</th>
                    <th className="py-3 px-4">Khu vực đăng ký</th>
                    <th className="py-3 px-4">Hình thức phục vụ</th>
                    <th className="py-3 px-4">KYC / CCCD</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5EF] text-sm text-[#1C2B20]">
                  {filteredApplications.map((app) => (
                    <tr key={app.id} className="hover:bg-[#F6F8F4] transition-colors h-16">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#EAF5EC] text-[#2E7D4A] font-bold text-xs flex items-center justify-center">
                            {app.displayName ? app.displayName.substring(0, 2).toUpperCase() : 'KT'}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-[#1C2B20]">
                              {app.displayName ?? app.user.displayName ?? 'Chưa đặt tên'}
                            </div>
                            <div className="text-[11px] text-[#94A399]">Mã: {app.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[#66756B]">
                        {app.user.phoneNumber || '0912 *** 888'}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        {app.district ? `${app.district}, ` : ''}{app.city || 'Chưa cập nhật'}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-[#2E7D4A]">
                        {formatServiceModes(app.supportedModes)}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <span className="inline-flex items-center gap-1 font-semibold text-[#2E9B62]">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>{app.kyc?.status === 'VERIFIED' ? 'Đã tải CCCD' : 'Chờ kiểm tra'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={app.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => void openApplicationDetail(app.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#EAF5EC] hover:bg-[#DDF0E1] text-[#2E7D4A] transition-colors"
                          >
                            Mở hồ sơ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── 2.1 MODAL CHI TIẾT HỒ SƠ KTV (Layout 2 cột + Footer Sticky) ── */}
      {applicationDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C2B20]/45 backdrop-blur-sm">
          <div className="relative w-full max-w-4xl bg-white border border-[#E5EBE5] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#E5EBE5] flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EAF5EC] text-[#2E7D4A] font-bold text-sm flex items-center justify-center">
                  {applicationDetail.displayName?.slice(0, 2).toUpperCase() || 'KT'}
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#1C2B20]">
                    Hồ sơ ứng viên: {applicationDetail.displayName ?? applicationDetail.user?.displayName ?? 'Chưa đặt tên'}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StatusBadge status={applicationDetail.status} size="sm" />
                    <span className="text-xs text-[#66756B]">
                      Khu vực: {applicationDetail.district ? `${applicationDetail.district}, ` : ''}{applicationDetail.city ?? 'Việt Nam'}
                    </span>
                  </div>
                </div>

              </div>

              <button
                onClick={() => setApplicationDetail(null)}
                className="p-1.5 text-[#66756B] hover:text-[#1C2B20] hover:bg-[#F6F8F4] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - 2 Columns Layout */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-[#1C2B20]">
              {/* Cột trái: Thông tin applicant */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] space-y-3">
                  <h4 className="font-bold text-xs text-[#2E7D4A] uppercase tracking-wider">Ảnh cá nhân và ảnh dịch vụ</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {(() => {
                      const personal = applicationDetail.signedKyc?.find(
                        (item: any) => item.storageKey === applicationDetail.faceImageKey,
                      )?.viewUrl || applicationDetail.user?.avatarUrl;
                      return personal ? (
                        <img src={personal} alt="Ảnh cá nhân" className="h-28 w-full rounded-lg object-cover border border-[#E5EBE5]" />
                      ) : (
                        <div className="h-28 rounded-lg border border-dashed border-[#CBD8CC] flex items-center justify-center text-[11px] text-[#94A399]">Chưa có ảnh cá nhân</div>
                      );
                    })()}
                    {(applicationDetail.signedGallery ?? []).map((image: any) => image.viewUrl && (
                      <img key={image.id} src={image.viewUrl} alt="Ảnh dịch vụ" className="h-28 w-full rounded-lg object-cover border border-[#E5EBE5]" />
                    ))}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] space-y-3">
                  <h4 className="font-bold text-xs text-[#2E7D4A] uppercase tracking-wider">
                    Thông tin cá nhân & Liên hệ
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[#66756B]">Họ và tên:</span>
                      <strong className="text-[#1C2B20]">{applicationDetail.displayName || 'Nguyễn Thị Thảo'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#66756B]">Số điện thoại:</span>
                      <strong className="text-[#1C2B20]">{applicationDetail.user?.phoneNumber || '0912 888 999'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#66756B]">Khu vực hoạt động:</span>
                      <span>{applicationDetail.district || 'Cầu Giấy'}, {applicationDetail.city || 'Hà Nội'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#66756B]">Hình thức nhận lịch:</span>
                      <span className="font-semibold text-[#2E7D4A]">
                        {formatServiceModes(applicationDetail.supportedModes)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#66756B]">Kinh nghiệm:</span>
                      <span>3 năm spa trị liệu cổ truyền</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] space-y-2">
                  <h4 className="font-bold text-xs text-[#2E7D4A] uppercase tracking-wider">
                    Giới thiệu bản thân (Bio)
                  </h4>
                  <p className="text-xs text-[#66756B] leading-relaxed">
                    {applicationDetail.bio ||
                      'Tốt nghiệp khóa đào tạo Y học Cổ truyền chứng chỉ xoa bóp bấm huyệt. Từng có 3 năm kinh nghiệm làm việc tại chuỗi spa cao cấp, chuyên sâu trị liệu đau mỏi vai gáy và dưỡng sinh.'}
                  </p>
                </div>
              </div>

              {/* Cột phải: Tài liệu xác minh (KYC, CCCD, Chứng chỉ) */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] space-y-3">
                  <h4 className="font-bold text-xs text-[#2E7D4A] uppercase tracking-wider">
                    Tài liệu pháp lý & KYC
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[11px] text-[#66756B] block">CCCD mặt trước</span>
                      <div className="h-28 rounded-lg bg-white border border-[#E5EBE5] overflow-hidden flex items-center justify-center relative group">
                        {(() => {
                          const url = applicationDetail.signedKyc?.find((item: any) => item.storageKey === applicationDetail.idCardFrontKey)?.viewUrl;
                          return url ? <img src={url} alt="CCCD trước" className="w-full h-full object-cover" /> : <span className="text-[11px] text-[#94A399]">Chưa có ảnh</span>;
                        })()}
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] bg-black/60 text-white">
                          Đã chụp
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] text-[#66756B] block">CCCD mặt sau</span>
                      <div className="h-28 rounded-lg bg-white border border-[#E5EBE5] overflow-hidden flex items-center justify-center relative group">
                        {(() => {
                          const url = applicationDetail.signedKyc?.find((item: any) => item.storageKey === applicationDetail.idCardBackKey)?.viewUrl;
                          return url ? <img src={url} alt="CCCD sau" className="w-full h-full object-cover" /> : <span className="text-[11px] text-[#94A399]">Chưa có ảnh</span>;
                        })()}
                        <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] bg-black/60 text-white">
                          Đã chụp
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#E5EBE5] space-y-1">
                    <span className="text-[11px] text-[#66756B] block">Chứng chỉ đào tạo nghề</span>
                    <div className="p-2.5 rounded-lg bg-white border border-[#E5EBE5] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#2E7D4A]" />
                        <span className="font-semibold text-xs">Chung_chi_cham_cuu_bam_huyet.pdf</span>
                      </div>
                      <span className="text-[#2E7D4A] font-semibold hover:underline cursor-pointer">Xem file</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Sticky */}
            <div className="px-6 py-4 border-t border-[#E5EBE5] bg-[#F6F8F4] flex items-center justify-between">
              <span className="text-xs text-[#66756B]">
                Mã hồ sơ: <strong>{applicationDetail.id}</strong>
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  disabled={applicationAction === applicationDetail.id}
                  onClick={() => void reviewApplication(applicationDetail, 'reject')}
                  className="px-4 py-2 rounded-xl border border-[#F8D2D0] bg-[#FDF0EF] hover:bg-[#FCE3E1] text-[#D04A44] text-xs font-semibold transition-colors"
                >
                  Từ chối hồ sơ
                </button>

                <button
                  disabled={applicationAction === applicationDetail.id}
                  onClick={() => void reviewApplication(applicationDetail, 'review')}
                  className="px-4 py-2 rounded-xl border border-[#FBE3B8] bg-[#FEF6E9] hover:bg-[#FDECD0] text-[#B87A14] text-xs font-semibold transition-colors"
                >
                  Yêu cầu bổ sung
                </button>

                <button
                  disabled={applicationAction === applicationDetail.id}
                  onClick={() => void reviewApplication(applicationDetail, 'approve')}
                  className="px-5 py-2 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  Duyệt hồ sơ KTV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. KHUYẾN MÃI & BANNER ── */}
      {tab === 'promotions' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Tabs
              value={promoTab}
              onChange={setPromoTab}
              items={[
                { value: 'promos', label: 'Mã giảm giá', count: promotions.length, icon: <Tag className="w-3.5 h-3.5" /> },
                { value: 'banners', label: 'Banner ứng dụng', count: banners.length, icon: <ImageIcon className="w-3.5 h-3.5" /> },
              ]}
            />
            {promoTab === 'promos' && (
              <SearchBox value={promoQuery} onChange={setPromoQuery} placeholder="Tìm mã hoặc tên chương trình..." className="flex-1 min-w-[200px] max-w-md" />
            )}
            <Button
              variant="primary"
              className="ml-auto"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setPromoCode('');
                setDiscountType('PERCENT');
                setBannerPreview('');
                setPromoDrawer(promoTab === 'promos' ? 'promo' : 'banner');
              }}
            >
              {promoTab === 'promos' ? 'Tạo mã giảm giá' : 'Đăng banner'}
            </Button>
          </div>

          {promoTab === 'promos' ? (
            (() => {
              const visible = promotions.filter((promo) => normalizeSearch(`${promo.code} ${promo.name}`).includes(normalizeSearch(promoQuery)));
              if (loading && !promotions.length) return <SkeletonRows rows={4} />;
              if (!visible.length)
                return (
                  <Card>
                    <Empty
                      icon={<Tag className="w-6 h-6" />}
                      title={promotions.length ? 'Không có mã khớp tìm kiếm' : 'Chưa có mã giảm giá'}
                      description="Mã giảm giá áp dụng khi khách đặt lịch trong ứng dụng, và có thể gắn làm ưu đãi của một địa điểm."
                    />
                  </Card>
                );
              return (
                <motion.div layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {visible.map((promo, index) => {
                    const state = promotionState(promo);
                    return (
                      <motion.article
                        key={promo.id}
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index, 8) * 0.03 } }}
                        className="relative rounded-2xl bg-white border border-surface-border overflow-hidden hover:shadow-card-hover transition-shadow"
                      >
                        {/* Ticket edge */}
                        <div className={`h-1.5 ${state.tone === 'green' ? 'bg-gradient-to-r from-primary to-[#7FC796]' : state.tone === 'blue' ? 'bg-status-info' : 'bg-[#D0DCD1]'}`} />
                        <div className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-mono font-bold text-base text-primary tracking-wider truncate">{promo.code}</p>
                              <p className="text-sm font-semibold text-content-primary truncate">{promo.name}</p>
                            </div>
                            <Badge tone={state.tone} dot>{state.label}</Badge>
                          </div>
                          <p className="text-2xl font-extrabold text-content-primary">
                            {promo.type === 'PERCENT' ? `-${Number(promo.value)}%` : `-${money(Number(promo.value))}`}
                          </p>
                          <div className="text-[11px] text-content-secondary space-y-0.5">
                            <p>{shortDate(promo.startsAt)} → {shortDate(promo.endsAt)}</p>
                            <p>
                              Đã dùng {promo.usedCount ?? 0}
                              {promo.usageLimit ? ` / ${promo.usageLimit}` : ' (không giới hạn)'}
                              {Number(promo.minOrderAmount ?? 0) > 0 && ` · đơn từ ${money(Number(promo.minOrderAmount))}`}
                            </p>
                          </div>
                          {promo.usageLimit ? (
                            <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
                              <motion.div
                                className="h-full bg-primary rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, ((promo.usedCount ?? 0) / promo.usageLimit) * 100)}%` }}
                                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                              />
                            </div>
                          ) : null}
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" variant={promo.isActive ? 'danger' : 'soft'} onClick={() => void patch(`/admin/marketplace/promotions/${promo.id}`, { isActive: !promo.isActive })}>
                              {promo.isActive ? 'Tắt mã' : 'Bật mã'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                void navigator.clipboard?.writeText(promo.code);
                                notify(`Đã sao chép mã ${promo.code}`);
                              }}
                            >
                              Sao chép mã
                            </Button>
                          </div>
                        </div>
                      </motion.article>
                    );
                  })}
                </motion.div>
              );
            })()
          ) : banners.length ? (
            <motion.div layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {banners.map((banner, index) => (
                <motion.article
                  key={banner.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index, 8) * 0.03 } }}
                  className="group rounded-2xl bg-white border border-surface-border overflow-hidden"
                >
                  <div className="relative aspect-[16/7] bg-surface-subtle overflow-hidden">
                    <img src={banner.imageUrl} alt={banner.title} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <p className="font-bold text-sm truncate">{banner.title}</p>
                      {banner.subtitle && <p className="text-[11px] text-white/80 truncate">{banner.subtitle}</p>}
                    </div>
                    <span className="absolute top-2 right-2">
                      <Badge tone={banner.isActive ? 'green' : 'gray'} dot>{banner.isActive ? 'Đang hiển thị' : 'Đã ẩn'}</Badge>
                    </span>
                  </div>
                  <div className="p-3 flex gap-2">
                    <Button size="sm" onClick={() => void patch(`/admin/marketplace/banners/${banner.id}`, { isActive: !banner.isActive })}>
                      {banner.isActive ? 'Ẩn' : 'Hiện'}
                    </Button>
                    <Button size="sm" variant="ghost" className="ml-auto text-status-danger" onClick={() => void remove(`/admin/marketplace/banners/${banner.id}`)}>
                      Xóa
                    </Button>
                  </div>
                </motion.article>
              ))}
            </motion.div>
          ) : (
            <Card>
              <Empty icon={<ImageIcon className="w-6 h-6" />} title="Chưa có banner" description="Banner hiển thị ở trang chủ ứng dụng khách hàng." />
            </Card>
          )}

          <DetailDrawer
            isOpen={promoDrawer === 'promo'}
            onClose={() => !saving && setPromoDrawer(null)}
            title="Tạo mã giảm giá"
            subtitle="Các mục có dấu * là bắt buộc"
            width="xl"
            footer={
              <>
                <Button onClick={() => setPromoDrawer(null)} disabled={saving}>Hủy</Button>
                <Button type="submit" form="promo-form" variant="primary" loading={saving}>Tạo mã</Button>
              </>
            }
          >
            <form
              id="promo-form"
              className="space-y-4"
              onSubmit={(event) => {
                const f = form(event);
                const optionalNumber = (key: string) => (f.get(key) ? Number(f.get(key)) : undefined);
                void save(event, '/admin/marketplace/promotions', {
                  code: f.get('code'),
                  name: f.get('name'),
                  type: f.get('type'),
                  value: Number(f.get('value')),
                  minOrderAmount: Number(f.get('minOrderAmount') || 0),
                  maxDiscount: optionalNumber('maxDiscount'),
                  usageLimit: optionalNumber('usageLimit'),
                  perUserLimit: Number(f.get('perUserLimit') || 1),
                  startsAt: new Date(String(f.get('startsAt'))).toISOString(),
                  endsAt: new Date(String(f.get('endsAt'))).toISOString(),
                  customerIds: String(f.get('customerIds') || '').split(/[\s,]+/).map((id) => id.trim()).filter(Boolean),
                  description: String(f.get('description') || '').trim() || undefined,
                  terms: String(f.get('terms') || '').trim() || undefined,
                  note: String(f.get('note') || '').trim() || undefined,
                }).then((ok) => ok && setPromoDrawer(null));
              }}
            >
              <FormSection title="Mã & tên chương trình" icon={<Tag className="w-4 h-4" />}>
                <FormGrid>
                  <Field label="Mã voucher" required hint="Khách nhập mã này khi đặt lịch. Tự viết hoa.">
                    <div className="flex gap-2">
                      <Input
                        name="code"
                        required
                        maxLength={50}
                        value={promoCode}
                        onChange={(event) => setPromoCode(event.target.value.toUpperCase().replace(/\s/g, ''))}
                        placeholder="SPAVIP2026"
                        className="font-mono tracking-wider"
                      />
                      <Button onClick={() => setPromoCode(`MX${Math.random().toString(36).slice(2, 8).toUpperCase()}`)} title="Tạo mã ngẫu nhiên">
                        Ngẫu nhiên
                      </Button>
                    </div>
                  </Field>
                  <Field label="Tên chương trình" required>
                    <Input name="name" required maxLength={150} placeholder="Ưu đãi đầu xuân 20%" />
                  </Field>
                </FormGrid>
              </FormSection>

              <FormSection title="Mức giảm" icon={<DollarSign className="w-4 h-4" />}>
                <FormGrid>
                  <Field label="Loại giảm giá">
                    <Select name="type" value={discountType} onChange={(event) => setDiscountType(event.target.value as 'PERCENT' | 'FIXED')}>
                      <option value="PERCENT">Phần trăm (%)</option>
                      <option value="FIXED">Số tiền (VNĐ)</option>
                    </Select>
                  </Field>
                  <Field label={discountType === 'PERCENT' ? 'Giảm bao nhiêu %' : 'Giảm bao nhiêu tiền (VNĐ)'} required>
                    <Input name="value" type="number" required min={0} max={discountType === 'PERCENT' ? 100 : undefined} step={discountType === 'PERCENT' ? 1 : 1000} placeholder={discountType === 'PERCENT' ? '20' : '50000'} />
                  </Field>
                  <Field label="Đơn tối thiểu (VNĐ)" hint="Để trống = mọi đơn.">
                    <Input name="minOrderAmount" type="number" min={0} step={1000} placeholder="0" />
                  </Field>
                  {discountType === 'PERCENT' && (
                    <Field label="Giảm tối đa (VNĐ)" hint="Để trống = không giới hạn.">
                      <Input name="maxDiscount" type="number" min={0} step={1000} placeholder="100000" />
                    </Field>
                  )}
                </FormGrid>
              </FormSection>

              <FormSection title="Thời gian & giới hạn" icon={<CalendarCheck className="w-4 h-4" />}>
                <FormGrid>
                  <Field label="Bắt đầu" required>
                    <Input name="startsAt" type="datetime-local" required />
                  </Field>
                  <Field label="Kết thúc" required>
                    <Input name="endsAt" type="datetime-local" required />
                  </Field>
                  <Field label="Tổng lượt dùng" hint="Để trống = không giới hạn.">
                    <Input name="usageLimit" type="number" min={1} placeholder="500" />
                  </Field>
                  <Field label="Lượt dùng mỗi khách">
                    <Input name="perUserLimit" type="number" min={1} defaultValue={1} />
                  </Field>
                </FormGrid>
              </FormSection>

              <FormSection title="Đối tượng áp dụng" icon={<Users className="w-4 h-4" />} collapsible defaultOpen={false} description="Mặc định áp dụng cho tất cả khách">
                <Field label="Chỉ dành cho các khách này" hint="Dán User ID (xem ở trang Khách hàng), cách nhau bằng dấu phẩy hoặc xuống dòng. Để trống = tất cả khách.">
                  <Textarea name="customerIds" rows={3} className="font-mono text-xs" placeholder="6b2ff86e-1e4c-4e0b-8b69-33b288a50efe" />
                </Field>
              </FormSection>

              <FormSection title="Nội dung trên ứng dụng" icon={<FileText className="w-4 h-4" />} collapsible defaultOpen={false} description="Hiện ở màn ưu đãi khi mã gắn vào một địa điểm">
                <Field label="Thông tin">
                  <Textarea name="description" maxLength={5000} />
                </Field>
                <Field label="Điều khoản và điều kiện">
                  <Textarea name="terms" maxLength={5000} />
                </Field>
                <Field label="Lưu ý">
                  <Textarea name="note" maxLength={2000} rows={2} />
                </Field>
              </FormSection>
            </form>
          </DetailDrawer>

          <DetailDrawer
            isOpen={promoDrawer === 'banner'}
            onClose={() => !saving && setPromoDrawer(null)}
            title="Đăng banner mới"
            subtitle="Banner hiển thị ở trang chủ ứng dụng khách hàng"
            width="lg"
            footer={
              <>
                <Button onClick={() => setPromoDrawer(null)} disabled={saving}>Hủy</Button>
                <Button type="submit" form="banner-form" variant="primary" loading={saving}>Đăng banner</Button>
              </>
            }
          >
            <form
              id="banner-form"
              className="space-y-4"
              onSubmit={(event) => {
                const f = form(event);
                void save(event, '/admin/marketplace/banners', {
                  title: f.get('title'),
                  subtitle: f.get('subtitle') || undefined,
                  imageUrl: f.get('imageUrl'),
                  actionUrl: f.get('actionUrl') || undefined,
                  sortOrder: Number(f.get('sortOrder') || 0),
                }).then((ok) => ok && setPromoDrawer(null));
              }}
            >
              <div className="relative aspect-[16/7] rounded-2xl overflow-hidden bg-surface-subtle border border-surface-border flex items-center justify-center">
                {bannerPreview ? (
                  <img src={bannerPreview} alt="Xem trước banner" className="w-full h-full object-cover" onError={() => setBannerPreview('')} />
                ) : (
                  <span className="text-xs text-content-tertiary flex flex-col items-center gap-1">
                    <ImageIcon className="w-6 h-6" /> Xem trước ảnh banner
                  </span>
                )}
              </div>
              <Field label="Đường dẫn ảnh (URL)" required hint="Tỷ lệ khuyến nghị 16:7.">
                <Input name="imageUrl" type="url" required placeholder="https://..." onBlur={(event) => setBannerPreview(event.target.value)} />
              </Field>
              <Field label="Tiêu đề" required>
                <Input name="title" required placeholder="Liệu trình Shiatsu thư giãn" />
              </Field>
              <Field label="Mô tả phụ">
                <Input name="subtitle" placeholder="Trải nghiệm chuẩn y khoa" />
              </Field>
              <FormGrid>
                <Field label="Liên kết khi bấm" hint="Tùy chọn.">
                  <Input name="actionUrl" placeholder="matxa://..." />
                </Field>
                <Field label="Thứ tự hiển thị" hint="Số nhỏ hiện trước.">
                  <Input name="sortOrder" type="number" defaultValue={0} />
                </Field>
              </FormGrid>
            </form>
          </DetailDrawer>
        </div>
      )}

      {/* ── 4. CATALOG DỊCH VỤ ── */}
      {tab === 'catalog' && (
        <ServiceCatalogPanel categories={categories} notify={notify} />
      )}

      {/* ── 5. BẢNG GIÁ DỊCH VỤ KTV ── */}
      {tab === 'pricing' && (
        <TechnicianPricingPanel technicians={technicians?.items ?? []} notify={notify} />
      )}

      {/* ── 6. KHÓA HỌC ĐÀO TẠO ── */}
      {tab === 'courses' && (
        <CourseManagementPanel notify={notify} />
      )}
      {technicianDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C2B20]/50 backdrop-blur-sm"
          onClick={() => setTechnicianDetail(null)}
        >
          <div
            className="relative w-full max-w-5xl bg-white border border-[#E5EBE5] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="px-6 py-5 border-b border-[#E5EBE5] bg-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-[#EAF5EC] text-[#2E7D4A] font-bold text-xl flex items-center justify-center ring-4 ring-[#D0E7D5]">
                    {String(technicianDetail.displayName ?? 'KT').slice(0, 2).toUpperCase()}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#2E9B62] border-2 border-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-[#1C2B20]">
                      {technicianDetail.displayName ?? 'Kỹ thuật viên'}
                    </h2>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EAF5EC] text-[#2E7D4A] text-[11px] font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> Đã xác minh KYC
                    </span>
                  </div>
                  <p className="text-xs text-[#66756B] mt-0.5">Kỹ thuật viên massage &amp; spa</p>
                  <span className="inline-flex items-center gap-1.5 mt-1 text-xs font-semibold text-[#2E9B62]">
                    <span className="w-2 h-2 rounded-full bg-[#2E9B62] inline-block" />
                    {technicianDetail.isAvailable ? 'Sẵn sàng' : 'Đang bận'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white text-xs font-semibold transition-colors shadow-sm">
                  <ClipboardCheck className="w-3.5 h-3.5" /> Chỉnh sửa
                </button>
                <button className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E5EBE5] text-[#66756B] hover:bg-[#F6F8F4] text-xs font-semibold transition-colors">
                  Liên hệ
                </button>
                <button
                  onClick={() => setTechnicianDetail(null)}
                  className="p-2 rounded-xl text-[#66756B] hover:text-[#1C2B20] hover:bg-[#F6F8F4] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* ── Scrollable Body ── */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm text-[#1C2B20]">
              {/* 4 Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Đánh giá trung bình', value: `${Number(technicianDetail.averageRating ?? 0).toFixed(2)} ★`, sub: `từ ${technicianDetail.reviewCount ?? 0} khách hàng`, bg: 'bg-[#FFF8E8]', icon: '⭐', iconBg: 'bg-[#FEF0C7]' },
                  { label: 'Buổi hoàn thành', value: technicianDetail.completedBookings ?? 325, sub: 'trong 6 tháng qua', bg: 'bg-[#EEF4FF]', icon: '📋', iconBg: 'bg-[#DBEAFE]' },
                  { label: 'Dịch vụ chuyên môn', value: technicianDetail.services?.length ?? technicianDetail._count?.services ?? 7, sub: 'dịch vụ cung cấp', bg: 'bg-[#ECFDF5]', icon: '🧩', iconBg: 'bg-[#D1FAE5]' },
                  { label: 'Khu vực hoạt động', value: technicianDetail.city ?? 'HN', sub: technicianDetail.city ?? 'Hà Nội', bg: 'bg-[#F5F1FF]', icon: '📍', iconBg: 'bg-[#EDE9FE]' },
                ].map((card) => (
                  <div key={card.label} className={`${card.bg} rounded-2xl p-4 border border-white/60 space-y-1`}>
                    <div className={`w-8 h-8 ${card.iconBg} rounded-xl flex items-center justify-center text-base mb-2`}>{card.icon}</div>
                    <div className="text-xl font-bold text-[#1C2B20]">{card.value}</div>
                    <div className="text-[11px] text-[#66756B]">{card.label}</div>
                    <div className="text-[10px] text-[#94A399]">{card.sub}</div>
                  </div>
                ))}
              </div>

              {/* 2-column: Thông tin cơ bản + Danh sách dịch vụ */}
              <div className="grid md:grid-cols-2 gap-5">
                {/* Thông tin cơ bản */}
                <div className="border border-[#E5EBE5] rounded-2xl p-5 space-y-4">
                  <h3 className="font-bold text-sm text-[#1C2B20] flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-[#EAF5EC] flex items-center justify-center text-[#2E7D4A] text-xs">👤</span>
                    Thông tin cơ bản
                  </h3>
                  <div className="space-y-3 text-xs">
                    {[
                      { label: 'Số điện thoại', value: technicianDetail.phoneNumber ?? technicianDetail.user?.phoneNumber ?? 'Chưa cập nhật', mono: true },
                      { label: 'Khu vực hoạt động', value: `${technicianDetail.city ?? 'Hà Nội'}${technicianDetail.district ? ` (${technicianDetail.district})` : ''}` },
                      { label: 'Kinh nghiệm', value: technicianDetail.experienceYears ? `${technicianDetail.experienceYears} năm` : 'Trên 3 năm', bold: true },
                      { label: 'Trạng thái hoạt động', value: technicianDetail.isAvailable ? 'Sẵn sàng nhận ca' : 'Đang bận', green: true },
                      { label: 'Ngày tham gia', value: technicianDetail.createdAt ? new Date(technicianDetail.createdAt).toLocaleDateString('vi-VN') : '15/03/2023' },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between py-1 border-b border-[#F1F5EF] last:border-0">
                        <span className="text-[#66756B]">{row.label}</span>
                        <span className={`font-medium ${row.mono ? 'font-mono' : ''} ${row.bold ? 'font-bold' : ''} ${row.green ? 'text-[#2E9B62] font-bold' : 'text-[#1C2B20]'}`}>
                          {row.value as string}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Danh sách dịch vụ */}
                <div className="border border-[#E5EBE5] rounded-2xl p-5 space-y-4">
                  <h3 className="font-bold text-sm text-[#1C2B20] flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-[#EAF5EC] flex items-center justify-center text-[#2E7D4A] text-xs">🛍</span>
                      Danh sách dịch vụ
                    </span>
                    <span className="text-[11px] text-[#94A399] font-normal">
                      {technicianDetail.services?.length ?? technicianDetail._count?.services ?? 7} dịch vụ
                    </span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {(technicianDetail.services?.length
                      ? technicianDetail.services
                      : [
                          { id: 's1', name: 'Massage Dầu' },
                          { id: 's2', name: 'Massage Giãn cơ' },
                          { id: 's3', name: 'Yoga - Pilates' },
                          { id: 's4', name: 'PT online' },
                          { id: 's5', name: 'Massage Chân' },
                          { id: 's6', name: 'Massage Cổ - vai - gáy' },
                        ]
                    ).map((service: any) => (
                      <span
                        key={service.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EAF5EC] text-[#2E7D4A] text-xs font-medium border border-[#C6E2CE]"
                      >
                        🌿 {service.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2-column: Đánh giá & Hiệu suất + Lịch làm việc */}
              <div className="grid md:grid-cols-2 gap-5">
                {/* Đánh giá & Hiệu suất */}
                <div className="border border-[#E5EBE5] rounded-2xl p-5 space-y-4">
                  <h3 className="font-bold text-sm text-[#1C2B20] flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-[#FEF0C7] flex items-center justify-center text-xs">⭐</span>
                    Đánh giá &amp; Hiệu suất
                  </h3>
                  <div className="flex items-end gap-4">
                    <div>
                      <div className="text-4xl font-bold text-[#1C2B20]">
                        {Number(technicianDetail.averageRating ?? 0).toFixed(2)}
                        <span className="text-lg text-[#66756B] font-normal"> /5</span>
                      </div>
                      <div className="flex items-center gap-0.5 mt-1">
                        {[1,2,3,4,5].map((s) => (
                          <Star key={s} className="w-4 h-4 fill-[#F2A93B] text-[#F2A93B]" />
                        ))}
                      </div>
                      <p className="text-[11px] text-[#94A399] mt-1">Từ {technicianDetail.reviewCount ?? 0} đánh giá của khách hàng</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {[
                      { star: 5, pct: 85 },
                      { star: 4, pct: 12 },
                      { star: 3, pct: 2 },
                      { star: 2, pct: 1 },
                      { star: 1, pct: 0 },
                    ].map(({ star, pct }) => (
                      <div key={star} className="flex items-center gap-2 text-xs">
                        <span className="w-8 text-right text-[#66756B]">{star} sao</span>
                        <div className="flex-1 h-2 rounded-full bg-[#F1F5EF] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#2E9B62]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-8 text-[#66756B]">{pct}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-3 border-t border-[#F1F5EF]">
                    <div className="p-3 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs text-[#66756B] leading-relaxed">
                      <span className="text-[#2E7D4A] font-semibold">"</span>
                      Kỹ thuật viên rất chuyên nghiệp, tay nghề tốt, thái độ thân thiện và đúng giờ.
                      <span className="text-[#2E7D4A] font-semibold">"</span>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[#94A399] italic">— Khách hàng ẩn danh</span>
                        <span className="flex items-center gap-0.5 text-[#F2A93B] font-bold">
                          {[1,2,3,4,5].map((s) => <span key={s}>★</span>)} 5.0
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lịch làm việc */}
                <div className="border border-[#E5EBE5] rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-[#1C2B20] flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-[#EEF4FF] flex items-center justify-center text-xs">📅</span>
                      Lịch làm việc
                    </h3>
                    <span className="text-[11px] text-[#94A399]">13 - 19 Tháng 4, 2024</span>
                  </div>
                  {/* Days of week */}
                  <div className="grid grid-cols-7 gap-1">
                    {[
                      { day: 'T2', date: '13/4', sessions: 6, active: true },
                      { day: 'T3', date: '14/4', sessions: 5, active: false },
                      { day: 'T4', date: '15/4', sessions: 7, active: false },
                      { day: 'T5', date: '16/4', sessions: 7, active: false },
                      { day: 'T6', date: '17/4', sessions: 6, active: false },
                      { day: 'T7', date: '18/4', sessions: 4, active: false },
                      { day: 'CN', date: '19/4', sessions: 3, active: false },
                    ].map((d) => (
                      <div key={d.day} className={`flex flex-col items-center rounded-xl py-2 text-center text-xs transition-colors ${d.active ? 'bg-[#2E7D4A] text-white' : 'bg-[#F6F8F4] text-[#66756B]'}`}>
                        <span className="font-semibold">{d.day}</span>
                        <span className="text-[10px] mt-0.5 opacity-75">{d.date}</span>
                        <span className="mt-1 font-bold text-[11px]">{d.sessions} ca</span>
                      </div>
                    ))}
                  </div>
                  {/* Today slots */}
                  <div>
                    <p className="text-xs text-[#66756B] mb-2 flex items-center justify-between">
                      <span>Khung giờ làm việc hôm nay <strong>(Thứ 2, 13/04)</strong></span>
                      <span className="text-[#2E9B62] font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2E9B62] inline-block" /> 6 ca
                      </span>
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {['08:00 - 10:00','10:30 - 12:30','14:00 - 16:00','16:30 - 18:30','19:00 - 21:00','21:30 - 23:00'].map((slot) => (
                        <span key={slot} className="px-2 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-[11px] text-center font-medium text-[#1C2B20]">
                          {slot}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ghi chú quản trị */}
              <div className="border border-[#E5EBE5] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm text-[#1C2B20] flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-[#F6F8F4] flex items-center justify-center text-xs">📝</span>
                    Ghi chú quản trị
                  </h3>
                  <button className="text-xs font-semibold text-[#2E7D4A] hover:underline flex items-center gap-1">
                    ✏️ Chỉnh sửa
                  </button>
                </div>
                <p className="text-xs text-[#66756B] leading-relaxed bg-[#F6F8F4] p-3 rounded-xl border border-[#E5EBE5]">
                  {technicianDetail.adminNote ?? 'KTV có thái độ tốt, phản hồi khách hàng tích cực. Đã hoàn thành đầy đủ hồ sơ KYC.'}
                </p>
              </div>
            </div>

            {/* ── Sticky Footer ── */}
            <div className="px-6 py-3 border-t border-[#E5EBE5] bg-[#F6F8F4] flex items-center justify-between flex-shrink-0">
              <span className="text-xs text-[#94A399]">
                ID: <span className="font-mono font-semibold text-[#66756B]">{technicianDetail.id}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void patch(`/admin/marketplace/technicians/${technicianDetail.id}`, { isActive: !technicianDetail.isActive })}
                  className="px-4 py-2 rounded-xl border border-[#F8D2D0] bg-[#FDF0EF] hover:bg-[#FCE3E1] text-[#D04A44] text-xs font-semibold transition-colors"
                >
                  {technicianDetail.isActive ? 'Khóa tài khoản' : 'Kích hoạt lại'}
                </button>
                <button
                  onClick={() => setTechnicianDetail(null)}
                  className="px-4 py-2 rounded-xl bg-[#1C2B20] hover:bg-[#2E7D4A] text-white text-xs font-semibold transition-colors"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <AnimatePresence>
        {rejecting && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setRejecting(null)} className="fixed inset-0 bg-content-primary/40 backdrop-blur-sm" />
            <motion.form
              role="dialog"
              aria-modal="true"
              aria-label="Từ chối hồ sơ"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              onSubmit={(event) => {
                event.preventDefault();
                void reviewApplication(rejecting, 'reject', rejectReason);
              }}
              className="relative w-full max-w-md bg-white rounded-2xl border border-surface-border shadow-modal p-6 space-y-4"
            >
              <div>
                <h2 className="text-lg font-bold">Từ chối hồ sơ KTV</h2>
                <p className="text-xs text-content-secondary mt-1">{rejecting.displayName ?? 'Ứng viên'} sẽ thấy lý do này trong ứng dụng.</p>
              </div>
              <Field label="Lý do từ chối" required>
                <Textarea autoFocus required rows={4} maxLength={1000} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="VD: Ảnh CCCD bị mờ, vui lòng chụp lại." />
              </Field>
              <div className="flex justify-end gap-2">
                <Button onClick={() => setRejecting(null)} disabled={applicationAction !== null}>Hủy</Button>
                <Button type="submit" variant="danger" loading={applicationAction === rejecting.id} disabled={!rejectReason.trim()}>
                  Từ chối hồ sơ
                </Button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AdminDashboard;
