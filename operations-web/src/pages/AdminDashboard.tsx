import { FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import { request } from '../api/client';
import { Card } from '../components/Card';
import { FormCard } from '../components/Form';
import { TechnicianPricingPanel } from '../components/TechnicianPricingPanel';
import { CalendarCheck, ClipboardCheck, DollarSign, FolderTree, Image as ImageIcon, LayoutDashboard, TicketPercent, UserCheck, Users } from 'lucide-react';
import type { Category } from '../types/api';

type Props = { notify: (message: string, error?: boolean) => void; refreshCategories: () => Promise<void> };
type Page<T> = { items: T[]; total: number; page: number; limit: number };
type Dashboard = { todayBookings: number; activeTechnicians: number; averageRating: number; reviewCount: number; completedBookingsThisMonth: number; revenueThisMonth: number };
type User = { id: string; displayName: string | null; email: string | null; phoneNumber: string | null; role: string; status: string; createdAt: string };
type Technician = { id: string; user: { id: string; displayName: string | null; status: string }; isActive: boolean; isVerified: boolean; isAvailable: boolean; averageRating: number; reviewCount: number; _count: { services: number } };
type Booking = { id: string; status: string; mode: string; scheduledStart: string; totalAmount: number; customer: { displayName: string | null }; technician: { user: { displayName: string | null } }; items: { serviceName: string }[] };
type Banner = { id: string; title: string; imageUrl: string; isActive: boolean; sortOrder: number };
type Promotion = { id: string; code: string; name: string; type: string; value: number; isActive: boolean; startsAt: string; endsAt: string };
type TechnicianApplication = { id: string; status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'; displayName: string | null; city: string | null; district: string | null; supportedModes: string[]; rejectionReason: string | null; user: { id: string; displayName: string | null }; kyc?: { status: string } | null };

const money = (value: number) => `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
const date = (value: string) => new Date(value).toLocaleString('vi-VN');

export function AdminDashboard({ notify, refreshCategories }: Props) {
  const [tab, setTab] = useState<'overview' | 'users' | 'bookings' | 'applications' | 'technicians' | 'pricing' | 'categories' | 'banners' | 'promotions'>('overview');
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
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextDashboard, nextCategories, nextUsers, nextBookings, nextTechnicians, nextBanners, nextPromotions, nextApplications] = await Promise.all([
        request<Dashboard>('/admin/marketplace/dashboard'), request<Category[]>('/admin/marketplace/categories'),
        request<Page<User>>('/admin/marketplace/users?limit=30'), request<Page<Booking>>('/admin/marketplace/bookings?limit=30'),
        request<Page<Technician>>('/admin/marketplace/technicians?limit=30'), request<Banner[]>('/admin/marketplace/banners'), request<Promotion[]>('/admin/marketplace/promotions'), request<Page<TechnicianApplication>>('/admin/marketplace/technician-applications?limit=30'),
      ]);
      setDashboard(nextDashboard); setCategories(nextCategories); setUsers(nextUsers); setBookings(nextBookings); setTechnicians(nextTechnicians); setBanners(nextBanners); setPromotions(nextPromotions); setApplications(nextApplications);
    } catch (error) { notify(error instanceof Error ? error.message : 'Không tải được dữ liệu quản trị', true); }
    finally { setLoading(false); }
  }, [notify]);
  useEffect(() => { void load(); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>, path: string, body: unknown) {
    event.preventDefault();
    try { await request(path, { method: 'POST', body: JSON.stringify(body) }); event.currentTarget.reset(); notify('Đã lưu dữ liệu.'); await load(); await refreshCategories(); }
    catch (error) { notify(error instanceof Error ? error.message : 'Không thể lưu dữ liệu', true); }
  }
  async function patch(path: string, body: unknown) {
    try { await request(path, { method: 'PATCH', body: JSON.stringify(body) }); notify('Đã cập nhật.'); await load(); await refreshCategories(); }
    catch (error) { notify(error instanceof Error ? error.message : 'Không thể cập nhật', true); }
  }
  async function remove(path: string) {
    try { await request(path, { method: 'DELETE' }); notify('Đã ẩn hoặc xóa dữ liệu.'); await load(); await refreshCategories(); }
    catch (error) { notify(error instanceof Error ? error.message : 'Không thể thực hiện', true); }
  }
  async function reviewApplication(application: TechnicianApplication, action: 'review' | 'approve' | 'reject') {
    let body: unknown = undefined;
    if (action === 'reject') {
      const reason = window.prompt('Lý do từ chối hồ sơ:');
      if (!reason?.trim()) return;
      body = { reason: reason.trim() };
    }
    setApplicationAction(application.id);
    try {
      await request(`/admin/marketplace/technician-applications/${application.id}/${action}`, { method: 'POST', ...(body ? { body: JSON.stringify(body) } : {}) });
      notify(action === 'approve' ? 'Đã duyệt kỹ thuật viên.' : action === 'reject' ? 'Đã từ chối hồ sơ.' : 'Hồ sơ đang được review.');
      await load();
    } catch (error) { notify(error instanceof Error ? error.message : 'Không thể xử lý hồ sơ', true); }
    finally { setApplicationAction(null); }
  }
  async function openApplicationDetail(id: string) {
    try { setApplicationDetail(await request(`/admin/marketplace/technician-applications/${id}`)); }
    catch (error) { notify(error instanceof Error ? error.message : 'Không tải được chi tiết hồ sơ', true); }
  }
  const form = (event: FormEvent<HTMLFormElement>) => new FormData(event.currentTarget);
  const nav = (value: typeof tab, label: string, icon: ReactNode) => <><button className={`tab-btn ${tab === value ? 'active' : ''}`} onClick={() => setTab(value)}>{icon}<span>{label}</span></button>{value === 'technicians' && <button className={`tab-btn ${tab === 'pricing' ? 'active' : ''}`} onClick={() => setTab('pricing')}><DollarSign size={18} /><span>Bảng giá KTV</span></button>}</>;

  return <div>
    <nav className="tabs-nav">
      {nav('overview', 'Tổng quan', <LayoutDashboard size={18} />)}{nav('users', 'Tài khoản', <Users size={18} />)}{nav('bookings', 'Lịch đặt', <CalendarCheck size={18} />)}
      {nav('technicians', 'Kỹ thuật viên', <UserCheck size={18} />)}{nav('categories', 'Danh mục', <FolderTree size={18} />)}
      {nav('banners', 'Banner', <ImageIcon size={18} />)}{nav('promotions', 'Khuyến mãi', <TicketPercent size={18} />)}
      <button className="quiet" onClick={() => void load()} disabled={loading}>{loading ? 'Đang tải…' : 'Làm mới'}</button>
      {nav('applications', 'Duyệt KTV', <ClipboardCheck size={18} />)}
    </nav>

    {tab === 'applications' && <Card title="Hồ sơ đăng ký kỹ thuật viên" subtitle={`${applications?.total ?? 0} hồ sơ; chỉ Admin mới duyệt.`}><div className="item-list">{applications?.items.map((application) => <div className="list-item-card" key={application.id}><div><div className="item-name">{application.displayName ?? application.user.displayName ?? 'Chưa đặt tên'} · {application.status}</div><div className="item-subtext">{application.city ?? '—'} · {application.district ?? '—'} · KYC: {application.kyc?.status ?? 'NOT_STARTED'}</div></div><div className="button-row">{application.status === 'SUBMITTED' && <button className="quiet" disabled={applicationAction === application.id} onClick={() => void reviewApplication(application, 'review')}>Nhận review</button>}{(application.status === 'SUBMITTED' || application.status === 'UNDER_REVIEW') && <><button className="quiet" disabled={applicationAction === application.id} onClick={() => void reviewApplication(application, 'approve')}>Duyệt</button><button className="quiet" disabled={applicationAction === application.id} onClick={() => void reviewApplication(application, 'reject')}>Từ chối</button></>}</div></div>)}</div></Card>}

    {tab === 'pricing' && <TechnicianPricingPanel technicians={technicians?.items ?? []} notify={notify} />}

    {tab === 'overview' && <>
      <div className="kpi-grid">
        <Kpi label="Doanh thu hoàn thành tháng này" value={money(dashboard?.revenueThisMonth ?? 0)} /><Kpi label="KTV đang hoạt động" value={`${dashboard?.activeTechnicians ?? 0}`} />
        <Kpi label="Lịch hẹn hôm nay" value={`${dashboard?.todayBookings ?? 0}`} /><Kpi label="Đánh giá trung bình" value={`${(dashboard?.averageRating ?? 0).toFixed(2)} / 5 (${dashboard?.reviewCount ?? 0})`} />
      </div>
      <div className="grid two"><Card title="Dữ liệu vận hành" subtitle="Các số liệu được đọc trực tiếp từ hệ thống"><p className="muted">Đơn hoàn thành trong tháng: <b>{dashboard?.completedBookingsThisMonth ?? 0}</b></p><p className="muted">Không có dữ liệu demo hoặc số liệu giả trên trang này.</p></Card>
      <Card title="Điều hành nhanh" subtitle="Chọn tab để quản lý"><div className="item-list"><div className="list-item-card"><span>Người dùng: {users?.total ?? 0}</span><button className="quiet" onClick={() => setTab('users')}>Mở</button></div><div className="list-item-card"><span>Booking: {bookings?.total ?? 0}</span><button className="quiet" onClick={() => setTab('bookings')}>Mở</button></div></div></Card></div>
    </>}

    {tab === 'users' && <Card title="Tài khoản người dùng" subtitle={`${users?.total ?? 0} tài khoản. Khóa sẽ vô hiệu phiên đăng nhập hiện tại.`}><div className="item-list">{users?.items.map((user) => <div className="list-item-card" key={user.id}><div className="item-info"><div className="item-avatar">{user.displayName?.slice(0, 1) ?? '?'}</div><div><div className="item-name">{user.displayName ?? 'Chưa đặt tên'} · {user.role}</div><div className="item-subtext">{user.email ?? user.phoneNumber ?? user.id} · {user.status}</div></div></div><button className="quiet" disabled={user.status === 'DELETED'} onClick={() => void patch(`/admin/marketplace/users/${user.id}/status`, { status: user.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE' })}>{user.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'}</button></div>)}</div></Card>}

    {tab === 'bookings' && <Card title="Tất cả lịch đặt" subtitle={`${bookings?.total ?? 0} booking; Admin chỉ giám sát, không thay đổi trạng thái nghiệp vụ tại đây.`}><div className="item-list">{bookings?.items.map((booking) => <div className="list-item-card" key={booking.id}><div><div className="item-name">{booking.items.map((item) => item.serviceName).join(', ') || 'Dịch vụ'} · {money(booking.totalAmount)}</div><div className="item-subtext">{booking.customer.displayName ?? 'Khách'} → {booking.technician.user.displayName ?? 'KTV'} · {date(booking.scheduledStart)}</div></div><span className="role-badge">{booking.status} · {booking.mode}</span></div>)}</div></Card>}

    {tab === 'technicians' && <div className="grid two"><Card title="Phê duyệt kỹ thuật viên" subtitle="Tạo/cập nhật hồ sơ KTV từ User ID"><FormCard onSubmit={(event) => { const f = form(event); void save(event, '/admin/marketplace/technicians', { userId: f.get('userId'), bio: f.get('bio') || undefined, city: f.get('city') || undefined, tags: String(f.get('tags') || '').split(',').map((v) => v.trim()).filter(Boolean), serviceModes: String(f.get('serviceModes') || '').split(',').filter(Boolean), isAvailable: f.get('isAvailable') === 'on', isActive: true }); }}><label>User ID<input name="userId" required /></label><label>Bio<textarea name="bio" maxLength={2000} /></label><label>Tags (cách nhau bởi dấu phẩy)<input name="tags" /></label><label>Hình thức phục vụ (HOME, ONSITE, ONLINE)<input name="serviceModes" required defaultValue="HOME" /></label><label>Thành phố<input name="city" /></label><label className="check"><input name="isAvailable" type="checkbox" />Sẵn sàng nhận lịch</label><button type="submit">Phê duyệt KTV</button></FormCard></Card>
      <Card title="Danh sách KTV" subtitle={`${technicians?.total ?? 0} hồ sơ`}><div className="item-list">{technicians?.items.map((tech) => <div className="list-item-card" key={tech.id}><div><div className="item-name">{tech.user.displayName ?? tech.id}</div><div className="item-subtext">{tech.isVerified ? 'Đã xác minh' : 'Chưa xác minh'} · {tech._count.services} dịch vụ · {tech.averageRating.toFixed(2)}★</div></div><button className="quiet" onClick={() => void patch(`/admin/marketplace/technicians/${tech.id}`, { isActive: !tech.isActive })}>{tech.isActive ? 'Ẩn' : 'Hiện'}</button></div>)}</div></Card></div>}

    {tab === 'categories' && <div className="grid two"><Card title="Tạo danh mục"><FormCard onSubmit={(event) => { const f = form(event); void save(event, '/admin/marketplace/categories', { name: f.get('name'), slug: f.get('slug'), iconUrl: f.get('iconUrl') || undefined, sortOrder: Number(f.get('sortOrder') || 0) }); }}><label>Tên<input name="name" required maxLength={100} /></label><label>Slug<input name="slug" required maxLength={100} /></label><label>Icon URL<input name="iconUrl" type="url" /></label><label>Thứ tự<input name="sortOrder" type="number" min="0" defaultValue="0" /></label><button>Tạo danh mục</button></FormCard></Card><Card title="Danh mục"><div className="item-list">{categories.map((category) => <div className="list-item-card" key={category.id}><div><div className="item-name">{category.name}</div><div className="item-subtext">{category.slug}</div></div><button className="quiet" onClick={() => void remove(`/admin/marketplace/categories/${category.id}`)}>Ẩn</button></div>)}</div></Card></div>}

    {tab === 'banners' && <div className="grid two"><Card title="Tạo banner"><FormCard onSubmit={(event) => { const f = form(event); void save(event, '/admin/marketplace/banners', { title: f.get('title'), subtitle: f.get('subtitle') || undefined, imageUrl: f.get('imageUrl'), actionUrl: f.get('actionUrl') || undefined, sortOrder: Number(f.get('sortOrder') || 0), startsAt: f.get('startsAt') ? new Date(String(f.get('startsAt'))).toISOString() : undefined, endsAt: f.get('endsAt') ? new Date(String(f.get('endsAt'))).toISOString() : undefined }); }}><label>Tiêu đề<input name="title" required /></label><label>Ảnh URL<input name="imageUrl" type="url" required /></label><label>Link khi bấm<input name="actionUrl" type="url" /></label><label>Thứ tự<input name="sortOrder" type="number" defaultValue="0" /></label><button>Đăng banner</button></FormCard></Card><Card title="Banner đã tạo"><div className="item-list">{banners.map((banner) => <div className="list-item-card" key={banner.id}><div><div className="item-name">{banner.title}</div><div className="item-subtext">{banner.isActive ? 'Đang hiện' : 'Đang ẩn'} · thứ tự {banner.sortOrder}</div></div><button className="quiet" onClick={() => void patch(`/admin/marketplace/banners/${banner.id}`, { isActive: !banner.isActive })}>{banner.isActive ? 'Ẩn' : 'Hiện'}</button><button className="quiet" onClick={() => void remove(`/admin/marketplace/banners/${banner.id}`)}>Xóa</button></div>)}</div></Card></div>}

    {tab === 'promotions' && <div className="grid two"><Card title="Tạo voucher"><FormCard onSubmit={(event) => { const f = form(event); void save(event, '/admin/marketplace/promotions', { code: f.get('code'), name: f.get('name'), type: f.get('type'), value: Number(f.get('value')), minOrderAmount: Number(f.get('minOrderAmount') || 0), maxDiscount: f.get('maxDiscount') ? Number(f.get('maxDiscount')) : undefined, usageLimit: f.get('usageLimit') ? Number(f.get('usageLimit')) : undefined, perUserLimit: Number(f.get('perUserLimit') || 1), startsAt: new Date(String(f.get('startsAt'))).toISOString(), endsAt: new Date(String(f.get('endsAt'))).toISOString() }); }}><label>Mã<input name="code" required /></label><label>Tên<input name="name" required /></label><label>Kiểu<select name="type"><option value="PERCENT">Phần trăm</option><option value="FIXED">Số tiền</option></select></label><label>Giá trị<input name="value" type="number" min="0" required /></label><label>Đơn tối thiểu<input name="minOrderAmount" type="number" min="0" /></label><label>Giảm tối đa<input name="maxDiscount" type="number" min="0" /></label><label>Giới hạn dùng<input name="usageLimit" type="number" min="1" /></label><label>Mỗi khách<input name="perUserLimit" type="number" min="1" defaultValue="1" /></label><label>Bắt đầu<input name="startsAt" type="datetime-local" required /></label><label>Kết thúc<input name="endsAt" type="datetime-local" required /></label><button>Tạo voucher</button></FormCard></Card><Card title="Voucher"><div className="item-list">{promotions.map((promo) => <div className="list-item-card" key={promo.id}><div><div className="item-name">{promo.code} · {promo.name}</div><div className="item-subtext">{promo.type === 'PERCENT' ? `${promo.value}%` : money(promo.value)} · {promo.isActive ? 'Đang bật' : 'Đang tắt'}</div></div><button className="quiet" onClick={() => void patch(`/admin/marketplace/promotions/${promo.id}`, { isActive: !promo.isActive })}>{promo.isActive ? 'Tắt' : 'Bật'}</button></div>)}</div></Card></div>}
  </div>;
}

function Kpi({ label, value }: { label: string; value: string }) { return <div className="kpi-card"><div className="kpi-label">{label}</div><div className="kpi-value">{value}</div></div>; }
