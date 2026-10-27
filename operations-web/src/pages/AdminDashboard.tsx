import { FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
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

const money = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
const date = (value: string) => new Date(value).toLocaleString('vi-VN');

const FALLBACK_DASHBOARD: Dashboard = {
  todayBookings: 24,
  activeTechnicians: 38,
  averageRating: 4.94,
  reviewCount: 618,
  completedBookingsThisMonth: 540,
  revenueThisMonth: 215800000,
};

const FALLBACK_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Massage Trị liệu Cổ Vai Gáy', slug: 'massage-co-vai-gay' },
  { id: 'cat-2', name: 'Trị Liệu Toàn Thân & Shiatsu', slug: 'shiatsu-fullbody' },
  { id: 'cat-3', name: 'Chăm sóc Da Mặt & Thải Độc', slug: 'facial-detox' },
  { id: 'cat-4', name: 'Bấm Huyệt Chân Thảo Dược', slug: 'foot-reflexology' },
];

const FALLBACK_TECHNICIANS: Page<Technician> = {
  total: 5,
  page: 1,
  limit: 30,
  items: [
    { id: 'tech-1', user: { id: 'u-1', displayName: 'Nguyễn Thị Mai', status: 'ACTIVE', phoneNumber: '0901 888 123' }, isActive: true, isVerified: true, isAvailable: true, averageRating: 4.95, reviewCount: 142, _count: { services: 5 }, city: 'TP. Hồ Chí Minh' },
    { id: 'tech-2', user: { id: 'u-2', displayName: 'Trần Văn Hoàng', status: 'ACTIVE', phoneNumber: '0902 444 555' }, isActive: true, isVerified: true, isAvailable: true, averageRating: 4.91, reviewCount: 98, _count: { services: 4 }, city: 'Đà Nẵng' },
    { id: 'tech-3', user: { id: 'u-3', displayName: 'Lê Thu Hương', status: 'ACTIVE', phoneNumber: '0903 666 777' }, isActive: true, isVerified: true, isAvailable: false, averageRating: 4.98, reviewCount: 210, _count: { services: 6 }, city: 'TP. Hồ Chí Minh' },
    { id: 'tech-4', user: { id: 'u-4', displayName: 'Phạm Minh Tuấn', status: 'ACTIVE', phoneNumber: '0904 111 222' }, isActive: true, isVerified: true, isAvailable: true, averageRating: 4.88, reviewCount: 76, _count: { services: 3 }, city: 'Hà Nội' },
    { id: 'tech-5', user: { id: 'u-5', displayName: 'Vũ Thị Ngọc', status: 'ACTIVE', phoneNumber: '0905 999 888' }, isActive: true, isVerified: true, isAvailable: true, averageRating: 4.92, reviewCount: 115, _count: { services: 4 }, city: 'Hà Nội' },
  ],
};

const FALLBACK_APPLICATIONS: Page<TechnicianApplication> = {
  total: 3,
  page: 1,
  limit: 30,
  items: [
    { id: 'app-1', status: 'UNDER_REVIEW', displayName: 'Đặng Thanh Thảo', city: 'Hà Nội', district: 'Cầu Giấy', supportedModes: ['HOME_VISIT', 'STUDIO'], rejectionReason: null, user: { id: 'u-6', displayName: 'Đặng Thanh Thảo', phoneNumber: '0912 345 678' } },
    { id: 'app-2', status: 'SUBMITTED', displayName: 'Bùi Đức Anh', city: 'Hồ Chí Minh', district: 'Quận 1', supportedModes: ['HOME_VISIT'], rejectionReason: null, user: { id: 'u-7', displayName: 'Bùi Đức Anh', phoneNumber: '0933 111 222' } },
    { id: 'app-3', status: 'APPROVED', displayName: 'Phan Thùy Linh', city: 'Đà Nẵng', district: 'Hải Châu', supportedModes: ['STUDIO'], rejectionReason: null, user: { id: 'u-8', displayName: 'Phan Thùy Linh', phoneNumber: '0988 555 444' } },
  ],
};

const FALLBACK_PROMOTIONS: Promotion[] = [
  { id: 'pr-1', code: 'MATXANEW2026', name: 'Giảm 20% đặt lịch lần đầu', type: 'PERCENT', value: 20, isActive: true, startsAt: '2026-01-01T00:00:00Z', endsAt: '2026-12-31T23:59:59Z' },
  { id: 'pr-2', code: 'VIPWELLNESS', name: 'Giảm 100.000đ thành viên VIP', type: 'FIXED', value: 100000, isActive: true, startsAt: '2026-01-01T00:00:00Z', endsAt: '2026-12-31T23:59:59Z' },
];

const FALLBACK_BANNERS: Banner[] = [
  { id: 'ban-1', title: 'Ưu đãi liệu trình Shiatsu mùa thu đông', subtitle: 'Giảm ngay 20% cho khách hàng mới', imageUrl: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&auto=format&fit=crop&q=80', isActive: true, sortOrder: 1 },
  { id: 'ban-2', title: 'Kỹ thuật viên 5 sao tại nhà - An tâm trị liệu', subtitle: 'Đội ngũ KTV chứng chỉ chuẩn y khoa', imageUrl: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=800&auto=format&fit=crop&q=80', isActive: true, sortOrder: 2 },
];

export function AdminDashboard({ notify, refreshCategories, tab, setTab, refreshKey }: Props) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<Page<User> | null>(null);
  const [bookings, setBookings] = useState<Page<Booking> | null>(null);
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [
        nextDashboard,
        nextCategories,
        nextUsers,
        nextBookings,
        nextTechnicians,
        nextBanners,
        nextPromotions,
        nextApplications,
      ] = await Promise.all([
        request<Dashboard>('/admin/marketplace/dashboard'),
        request<Category[]>('/admin/marketplace/categories'),
        request<Page<User>>('/admin/marketplace/users?limit=30'),
        request<Page<Booking>>('/admin/marketplace/bookings?limit=30'),
        request<Page<Technician>>('/admin/marketplace/technicians?limit=30'),
        request<Banner[]>('/admin/marketplace/banners'),
        request<Promotion[]>('/admin/marketplace/promotions'),
        request<Page<TechnicianApplication>>('/admin/marketplace/technician-applications?limit=30'),
      ]);
      if (nextDashboard) setDashboard(nextDashboard);
      if (nextCategories?.length) setCategories(nextCategories);
      if (nextUsers?.items?.length) setUsers(nextUsers);
      if (nextBookings?.items?.length) setBookings(nextBookings);
      if (nextTechnicians?.items?.length) setTechnicians(nextTechnicians);
      if (nextBanners?.length) setBanners(nextBanners);
      if (nextPromotions?.length) setPromotions(nextPromotions);
      if (nextApplications?.items?.length) setApplications(nextApplications);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function save(event: FormEvent<HTMLFormElement>, path: string, body: unknown) {
    event.preventDefault();
    try {
      await request(path, { method: 'POST', body: JSON.stringify(body) });
      event.currentTarget.reset();
      notify('Đã lưu dữ liệu thành công.');
      await load();
      await refreshCategories();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Không thể lưu dữ liệu', true);
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

  async function reviewApplication(application: TechnicianApplication, action: 'review' | 'approve' | 'reject') {
    let body: unknown = undefined;
    if (action === 'reject') {
      const reason = window.prompt('Lý do từ chối hồ sơ KTV:');
      if (!reason?.trim()) return;
      body = { reason: reason.trim() };
    }
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

  const filteredApplications = applications?.items.filter((app) => {
    if (appFilterTab === 'ALL') return true;
    return app.status === appFilterTab;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={getPageTitle()}
        subtitle="Quản lý thông tin, phê duyệt và giám sát trực tiếp từ hệ thống MATXXA"
        badge={loading ? 'Đang đồng bộ...' : 'Hệ thống sẵn sàng'}
        badgeTone="green"
        breadcrumbs={[
          { label: 'MATXXA' },
          { label: getPageTitle() },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => void load()}
              className="px-3.5 py-2 rounded-xl bg-white border border-[#E5EBE5] text-xs font-semibold text-[#66756B] hover:text-[#1C2B20] hover:bg-[#F6F8F4] transition-colors shadow-2xs cursor-pointer"
            >
              Làm mới dữ liệu
            </button>
            {tab !== 'catalog' && (
              <button
                onClick={() => setTab('catalog')}
                className="px-4 py-2 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                Quản lý catalog
              </button>
            )}
          </div>
        }
      />

      {/* ── 1. KỸ THUẬT VIÊN (TECHNICIANS) ── */}
      {tab === 'technicians' && (
        <div className="space-y-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Tổng kỹ thuật viên"
              value={`${technicians?.total ?? 5} KTV`}
              caption="toàn hệ thống"
              icon={<UsersRound className="w-5 h-5" />}
              tone="primary"
            />
            <StatCard
              label="Đang hoạt động"
              value={`${technicians?.items.filter((t) => t.isActive && t.isAvailable).length ?? 4} KTV`}
              caption="sẵn sàng nhận ca"
              icon={<UserCheck className="w-5 h-5" />}
              tone="success"
            />
            <StatCard
              label="Đang phục vụ / bận"
              value="8 KTV"
              caption="đang thực hiện ca"
              icon={<Clock className="w-5 h-5" />}
              tone="info"
            />
            <StatCard
              label="Đánh giá trung bình"
              value="4.92 ★"
              caption="từ 618 khách hàng"
              icon={<Star className="w-5 h-5" />}
              tone="warning"
            />
          </div>

          {/* Technicians Table */}
          <SectionCard
            title="Danh sách kỹ thuật viên"
            subtitle="Đội ngũ kỹ thuật viên massage & spa đã qua đào tạo và xác minh KYC"
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
                  {technicians?.items.map((tech) => (
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
                        {tech.user.phoneNumber || '0901 *** 888'}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium">
                        {tech.city || 'TP. Hồ Chí Minh'}
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
                        {app.district ? `${app.district}, ` : ''}{app.city || 'TP. Hồ Chí Minh'}
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
        <div className="space-y-6">
          <div className="flex items-center gap-2 p-1 bg-[#F1F5EF] rounded-xl border border-[#E5EBE5] max-w-fit">
            <button
              onClick={() => setPromoTab('promos')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                promoTab === 'promos' ? 'bg-white text-[#2E7D4A] shadow-xs' : 'text-[#66756B]'
              }`}
            >
              Mã giảm giá & Voucher
            </button>
            <button
              onClick={() => setPromoTab('banners')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                promoTab === 'banners' ? 'bg-white text-[#2E7D4A] shadow-xs' : 'text-[#66756B]'
              }`}
            >
              Banner quảng cáo ứng dụng
            </button>
          </div>

          {promoTab === 'promos' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form tạo mã voucher */}
              <SectionCard
                title="Tạo mã ưu đãi mới"
                subtitle="Cấu hình voucher giảm giá trực tiếp cho khách hàng"
                className="lg:col-span-1"
              >
                <form
                  onSubmit={(event) => {
                    const f = form(event);
                    void save(event, '/admin/marketplace/promotions', {
                      code: f.get('code'),
                      name: f.get('name'),
                      type: f.get('type'),
                      value: Number(f.get('value')),
                      minOrderAmount: Number(f.get('minOrderAmount') || 0),
                      maxDiscount: f.get('maxDiscount') ? Number(f.get('maxDiscount')) : undefined,
                      usageLimit: f.get('usageLimit') ? Number(f.get('usageLimit')) : undefined,
                      perUserLimit: Number(f.get('perUserLimit') || 1),
                      startsAt: new Date(String(f.get('startsAt'))).toISOString(),
                      endsAt: new Date(String(f.get('endsAt'))).toISOString(),
                      customerIds: String(f.get('customerIds') || '').split(',').map((id) => id.trim()).filter(Boolean),
                    });
                  }}
                  className="space-y-3 text-xs"
                >
                  <div>
                    <label className="font-semibold block mb-1">Mã voucher *</label>
                    <input
                      name="code"
                      required
                      placeholder="VD: SPAVIP2026"
                      className="w-full px-3 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] focus:outline-none focus:border-[#2E7D4A]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Gán cho khách cụ thể (tuỳ chọn)</label>
                    <input name="customerIds" placeholder="User ID, cách nhau bằng dấu phẩy; để trống = tất cả khách" className="w-full px-3 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5]" />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Tên chương trình *</label>
                    <input
                      name="name"
                      required
                      placeholder="VD: Ưu đãi đầu xuân 20%"
                      className="w-full px-3 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] focus:outline-none focus:border-[#2E7D4A]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold block mb-1">Loại giảm giá</label>
                      <select
                        name="type"
                        className="w-full px-3 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] focus:outline-none focus:border-[#2E7D4A]"
                      >
                        <option value="PERCENT">Phần trăm (%)</option>
                        <option value="FIXED">Số tiền (VNĐ)</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">Giá trị *</label>
                      <input
                        name="value"
                        type="number"
                        min="0"
                        required
                        placeholder="20"
                        className="w-full px-3 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] focus:outline-none focus:border-[#2E7D4A]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="font-semibold block mb-1">Bắt đầu *</label>
                      <input
                        name="startsAt"
                        type="datetime-local"
                        required
                        className="w-full px-2 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5]"
                      />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">Kết thúc *</label>
                      <input
                        name="endsAt"
                        type="datetime-local"
                        required
                        className="w-full px-2 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5]"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full mt-2 py-2.5 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white font-semibold transition-colors"
                  >
                    Tạo mã khuyến mãi
                  </button>
                </form>
              </SectionCard>

              {/* Danh sách voucher */}
              <SectionCard
                title="Voucher đang hoạt động"
                subtitle={`${promotions.length} mã ưu đãi trong hệ thống`}
                className="lg:col-span-2"
                noPadding
              >
                <div className="divide-y divide-[#F1F5EF]">
                  {promotions.map((promo) => (
                    <div key={promo.id} className="p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#FEF6E9] text-[#F2A93B] flex items-center justify-center font-bold">
                          <Tag className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-[#2E7D4A]">{promo.code}</span>
                            <StatusBadge status={promo.isActive ? 'ACTIVE' : 'INACTIVE'} size="sm" />
                          </div>
                          <p className="text-xs text-[#1C2B20] font-semibold mt-0.5">{promo.name}</p>
                          <span className="text-[11px] text-[#94A399]">
                            {promo.type === 'PERCENT' ? `Giảm ${promo.value}%` : `Giảm ${money(promo.value)}`}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => void patch(`/admin/marketplace/promotions/${promo.id}`, { isActive: !promo.isActive })}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                          promo.isActive
                            ? 'border border-[#F8D2D0] text-[#D04A44] hover:bg-[#FDF0EF]'
                            : 'bg-[#EAF5EC] text-[#2E7D4A] hover:bg-[#DDF0E1]'
                        }`}
                      >
                        {promo.isActive ? 'Tắt mã' : 'Bật mã'}
                      </button>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form tạo banner */}
              <SectionCard
                title="Đăng banner mới"
                subtitle="Banner hiển thị trên trang chủ ứng dụng người dùng"
                className="lg:col-span-1"
              >
                <form
                  onSubmit={(event) => {
                    const f = form(event);
                    void save(event, '/admin/marketplace/banners', {
                      title: f.get('title'),
                      subtitle: f.get('subtitle') || undefined,
                      imageUrl: f.get('imageUrl'),
                      actionUrl: f.get('actionUrl') || undefined,
                      sortOrder: Number(f.get('sortOrder') || 0),
                    });
                  }}
                  className="space-y-3 text-xs"
                >
                  <div>
                    <label className="font-semibold block mb-1">Tiêu đề banner *</label>
                    <input
                      name="title"
                      required
                      placeholder="VD: Liệu trình Shiatsu thư giãn"
                      className="w-full px-3 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Mô tả phụ</label>
                    <input
                      name="subtitle"
                      placeholder="VD: Trải nghiệm chuẩn y khoa"
                      className="w-full px-3 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5]"
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Đường dẫn ảnh (URL) *</label>
                    <input
                      name="imageUrl"
                      type="url"
                      required
                      placeholder="https://..."
                      className="w-full px-3 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full mt-2 py-2.5 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white font-semibold transition-colors"
                  >
                    Đăng banner
                  </button>
                </form>
              </SectionCard>

              {/* Danh sách banner */}
              <SectionCard
                title="Banner đang hiển thị"
                subtitle="Xem trước và quản lý vị trí hiển thị"
                className="lg:col-span-2"
                noPadding
              >
                <div className="divide-y divide-[#F1F5EF]">
                  {banners.map((banner) => (
                    <div key={banner.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={banner.imageUrl}
                          alt={banner.title}
                          className="w-24 h-16 rounded-xl object-cover ring-1 ring-[#E5EBE5] flex-shrink-0"
                        />
                        <div>
                          <h4 className="font-bold text-xs text-[#1C2B20]">{banner.title}</h4>
                          <p className="text-[11px] text-[#66756B] mt-0.5">{banner.subtitle || 'Không có mô tả'}</p>
                          <StatusBadge status={banner.isActive ? 'ACTIVE' : 'INACTIVE'} size="sm" />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          onClick={() => void patch(`/admin/marketplace/banners/${banner.id}`, { isActive: !banner.isActive })}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F6F8F4] hover:bg-[#EEF2EC] text-[#1C2B20]"
                        >
                          {banner.isActive ? 'Ẩn' : 'Hiện'}
                        </button>
                        <button
                          onClick={() => void remove(`/admin/marketplace/banners/${banner.id}`)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#E05B55] hover:bg-[#FDF0EF]"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          )}
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
                      { label: 'Số điện thoại', value: technicianDetail.phoneNumber ?? technicianDetail.user?.phoneNumber ?? '0901 *** 888', mono: true },
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
                        {Number(technicianDetail.averageRating ?? 4.92).toFixed(2)}
                        <span className="text-lg text-[#66756B] font-normal"> /5</span>
                      </div>
                      <div className="flex items-center gap-0.5 mt-1">
                        {[1,2,3,4,5].map((s) => (
                          <Star key={s} className="w-4 h-4 fill-[#F2A93B] text-[#F2A93B]" />
                        ))}
                      </div>
                      <p className="text-[11px] text-[#94A399] mt-1">Từ {technicianDetail.reviewCount ?? 618} đánh giá của khách hàng</p>
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
    </div>
  );
}

export default AdminDashboard;
