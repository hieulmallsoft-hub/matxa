import { FormEvent, type ReactNode, useCallback, useEffect, useState } from 'react';
import { request } from '../api/client';
import { Card } from '../components/Card';
import { FormCard } from '../components/Form';
import { TechnicianPricingPanel } from '../components/TechnicianPricingPanel';
import {
  CalendarCheck, ClipboardCheck, DollarSign,
  UserCheck, Users, Star,
  CheckCircle2, ChevronRight
} from 'lucide-react';
import type { Category } from '../types/api';

type TabKey = 'overview' | 'users' | 'bookings' | 'applications' | 'technicians' | 'pricing' | 'categories' | 'banners' | 'promotions';

type Props = {
  notify: (message: string, error?: boolean) => void;
  refreshCategories: () => Promise<void>;
  tab: TabKey;
  setTab: (tab: TabKey) => void;
  refreshKey: number;
};

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

const statusColor: Record<string, string> = {
  SUBMITTED: 'pending',
  UNDER_REVIEW: 'pending',
  APPROVED: '',
  REJECTED: 'danger',
  DRAFT: 'danger',
};

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
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextDashboard, nextCategories, nextUsers, nextBookings, nextTechnicians, nextBanners, nextPromotions, nextApplications] = await Promise.all([
        request<Dashboard>('/admin/marketplace/dashboard'), request<Category[]>('/admin/marketplace/categories'),
        request<Page<User>>('/admin/marketplace/users?limit=30'), request<Page<Booking>>('/admin/marketplace/bookings?limit=30'),
        request<Page<Technician>>('/admin/marketplace/technicians?limit=30'), request<Banner[]>('/admin/marketplace/banners'),
        request<Promotion[]>('/admin/marketplace/promotions'), request<Page<TechnicianApplication>>('/admin/marketplace/technician-applications?limit=30'),
      ]);
      setDashboard(nextDashboard); setCategories(nextCategories); setUsers(nextUsers); setBookings(nextBookings);
      setTechnicians(nextTechnicians); setBanners(nextBanners); setPromotions(nextPromotions); setApplications(nextApplications);
    } catch (error) { notify(error instanceof Error ? error.message : 'Không tải được dữ liệu quản trị', true); }
    finally { setLoading(false); }
  }, [notify]);

  useEffect(() => { void load(); }, [load, refreshKey]);

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

  return (
    <div>
      {/* ── Application Detail Modal ── */}
      {applicationDetail && (
        <div className="modal-backdrop" onClick={() => setApplicationDetail(null)}>
          <div className="application-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Chi tiết hồ sơ KTV</h2>
                <p className="muted">{applicationDetail.displayName ?? applicationDetail.user?.displayName ?? 'Chưa đặt tên'} · {applicationDetail.status}</p>
              </div>
              <button className="quiet" onClick={() => setApplicationDetail(null)}>Đóng</button>
            </div>
            <div className="detail-grid">
              <div>
                <h3>Hồ sơ</h3>
                <p><b>Thành phố:</b> {applicationDetail.city ?? '—'}</p>
                <p><b>Quận/huyện:</b> {applicationDetail.district ?? '—'}</p>
                <p><b>Giới tính:</b> {applicationDetail.gender ?? '—'}</p>
                <p><b>Hình thức:</b> {applicationDetail.supportedModes?.join(', ') || '—'}</p>
                <p><b>Bio:</b> {applicationDetail.bio ?? '—'}</p>
              </div>
              <div>
                <h3>KYC</h3>
                <p><b>Trạng thái:</b> {applicationDetail.kyc?.status ?? 'NOT_STARTED'}</p>
                <p><b>CCCD:</b> {applicationDetail.idCardFrontKey && applicationDetail.idCardBackKey ? 'Đã đủ hai mặt' : 'Chưa đủ ảnh'}</p>
                <p><b>Khuôn mặt:</b> {applicationDetail.faceImageKey ? 'Đã tải' : 'Chưa có'}</p>
                {applicationDetail.signedKyc?.length ? (
                  <div className="kyc-images">
                    {applicationDetail.signedKyc.map((img: any) => (
                      <figure key={img.storageKey}>
                        <img src={img.viewUrl} alt="KYC" />
                        <figcaption>{img.storageKey.split('/').slice(-2, -1)[0]}</figcaption>
                      </figure>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <h3>Dịch vụ &amp; bảng giá</h3>
            {applicationDetail.services?.length ? (
              <div className="item-list">
                {applicationDetail.services.map((service: any) => (
                  <div className="list-item-card" key={service.id}>
                    <b>{service.name ?? service.service?.name ?? 'Dịch vụ'}</b>
                    <div className="item-subtext">
                      {service.priceOptions?.map((o: any) => `${o.durationMinutes ?? o.label ?? ''}: ${money(Number(o.price))}`).join(' · ') || 'Chưa cấu hình giá'}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="muted">KTV chưa đăng ký dịch vụ.</p>}
          </div>
        </div>
      )}

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <>
          <div className="kpi-grid">
            <Kpi
              label="Doanh thu tháng này"
              value={money(dashboard?.revenueThisMonth ?? 0)}
              icon={<DollarSign size={20} />}
              trend="Hoàn thành"
            />
            <Kpi
              label="KTV đang hoạt động"
              value={`${dashboard?.activeTechnicians ?? 0}`}
              icon={<UserCheck size={20} />}
              trend="Kỹ thuật viên"
            />
            <Kpi
              label="Lịch hẹn hôm nay"
              value={`${dashboard?.todayBookings ?? 0}`}
              icon={<CalendarCheck size={20} />}
              trend="Booking mới"
            />
            <Kpi
              label="Đánh giá trung bình"
              value={`${(dashboard?.averageRating ?? 0).toFixed(2)}/5`}
              icon={<Star size={20} />}
              trend={`${dashboard?.reviewCount ?? 0} đánh giá`}
            />
          </div>

          <div className="grid two">
            <Card title="Dữ liệu vận hành" subtitle="Các số liệu được đọc trực tiếp từ hệ thống">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg-subtle)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckCircle2 size={18} style={{ color: 'var(--em-600)' }} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Đơn hoàn thành tháng này</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--em-700)' }}>{dashboard?.completedBookingsThisMonth ?? 0}</span>
                </div>
                <p className="muted" style={{ fontSize: '0.80rem' }}>Không có dữ liệu demo hoặc số liệu giả trên trang này. Tất cả được lấy từ API thực.</p>
              </div>
            </Card>

            <Card title="Điều hành nhanh" subtitle="Chọn mục để quản lý">
              <div className="quick-access-grid">
                {[
                  { label: 'Người dùng', count: users?.total ?? 0, key: 'users' as TabKey, icon: <Users size={15} /> },
                  { label: 'Booking', count: bookings?.total ?? 0, key: 'bookings' as TabKey, icon: <CalendarCheck size={15} /> },
                  { label: 'KTV', count: technicians?.total ?? 0, key: 'technicians' as TabKey, icon: <UserCheck size={15} /> },
                  { label: 'Hồ sơ KTV', count: applications?.total ?? 0, key: 'applications' as TabKey, icon: <ClipboardCheck size={15} /> },
                ].map(({ label, count, key, icon }) => (
                  <div key={key} className="quick-access-item" onClick={() => setTab(key)} role="button">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--em-700)', marginBottom: '4px' }}>{icon}<span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span></div>
                      <div className="quick-access-count">{count}</div>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}

      {/* ── APPLICATIONS ── */}
      {tab === 'applications' && (
        <Card title="Hồ sơ đăng ký kỹ thuật viên" subtitle={`${applications?.total ?? 0} hồ sơ — chỉ Admin mới duyệt.`}>
          <div className="item-list">
            {applications?.items.map((application) => (
              <div className="list-item-card" key={application.id}>
                <div>
                  <div className="item-name">{application.displayName ?? application.user.displayName ?? 'Chưa đặt tên'}</div>
                  <div className="item-subtext">{application.city ?? '—'} · {application.district ?? '—'} · KYC: {application.kyc?.status ?? 'NOT_STARTED'}</div>
                </div>
                <div className="button-row">
                  <span className={`role-badge ${statusColor[application.status] ?? ''}`}>{application.status}</span>
                  <button className="quiet" onClick={() => void openApplicationDetail(application.id)}>Xem hồ sơ</button>
                  {application.status === 'SUBMITTED' && (
                    <button className="review-btn" disabled={applicationAction === application.id} onClick={() => void reviewApplication(application, 'review')}>Nhận review</button>
                  )}
                  {(application.status === 'SUBMITTED' || application.status === 'UNDER_REVIEW') && (
                    <>
                      <button className="approve-btn" disabled={applicationAction === application.id} onClick={() => void reviewApplication(application, 'approve')}>Duyệt</button>
                      <button className="quiet" disabled={applicationAction === application.id} onClick={() => void reviewApplication(application, 'reject')}>Từ chối</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── PRICING ── */}
      {tab === 'pricing' && <TechnicianPricingPanel technicians={technicians?.items ?? []} notify={notify} />}

      {/* ── USERS ── */}
      {tab === 'users' && (
        <Card title="Tài khoản người dùng" subtitle={`${users?.total ?? 0} tài khoản. Khóa sẽ vô hiệu phiên đăng nhập hiện tại.`}>
          <div className="item-list">
            {users?.items.map((user) => (
              <div className="list-item-card" key={user.id}>
                <div className="item-info">
                  <div className="item-avatar">{user.displayName?.slice(0, 1) ?? '?'}</div>
                  <div>
                    <div className="item-name">{user.displayName ?? 'Chưa đặt tên'} <span className="role-badge" style={{ marginLeft: '4px' }}>{user.role}</span></div>
                    <div className="item-subtext">{user.email ?? user.phoneNumber ?? user.id} · {user.status}</div>
                  </div>
                </div>
                <button className="quiet" disabled={user.status === 'DELETED'} onClick={() => void patch(`/admin/marketplace/users/${user.id}/status`, { status: user.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE' })}>
                  {user.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'}
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── BOOKINGS ── */}
      {tab === 'bookings' && (
        <Card title="Tất cả lịch đặt" subtitle={`${bookings?.total ?? 0} booking — Admin chỉ giám sát, không thay đổi trạng thái nghiệp vụ tại đây.`}>
          <div className="item-list">
            {bookings?.items.map((booking) => (
              <div className="list-item-card" key={booking.id}>
                <div>
                  <div className="item-name">{booking.items.map((i) => i.serviceName).join(', ') || 'Dịch vụ'} · <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--em-700)' }}>{money(booking.totalAmount)}</span></div>
                  <div className="item-subtext">{booking.customer.displayName ?? 'Khách'} → {booking.technician.user.displayName ?? 'KTV'} · {date(booking.scheduledStart)}</div>
                </div>
                <div className="button-row">
                  <span className="role-badge">{booking.mode}</span>
                  <span className={`role-badge ${booking.status === 'CANCELLED' ? 'danger' : booking.status === 'COMPLETED' ? '' : 'pending'}`}>{booking.status}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── TECHNICIANS ── */}
      {tab === 'technicians' && (
        <div className="grid two">
          <Card title="Phê duyệt kỹ thuật viên" subtitle="Tạo/cập nhật hồ sơ KTV từ User ID">
            <FormCard onSubmit={(event) => {
              const f = form(event);
              void save(event, '/admin/marketplace/technicians', {
                userId: f.get('userId'), bio: f.get('bio') || undefined, city: f.get('city') || undefined,
                tags: String(f.get('tags') || '').split(',').map((v) => v.trim()).filter(Boolean),
                serviceModes: String(f.get('serviceModes') || '').split(',').filter(Boolean),
                isAvailable: f.get('isAvailable') === 'on', isActive: true,
              });
            }}>
              <label>User ID<input name="userId" required /></label>
              <label>Bio<textarea name="bio" maxLength={2000} /></label>
              <label>Tags (cách nhau bởi dấu phẩy)<input name="tags" /></label>
              <label>Hình thức phục vụ (HOME, ONSITE, ONLINE)<input name="serviceModes" required defaultValue="HOME" /></label>
              <label>Thành phố<input name="city" /></label>
              <label className="check"><input name="isAvailable" type="checkbox" />Sẵn sàng nhận lịch</label>
              <button type="submit">Phê duyệt KTV</button>
            </FormCard>
          </Card>
          <Card title="Danh sách KTV" subtitle={`${technicians?.total ?? 0} hồ sơ`}>
            <div className="item-list">
              {technicians?.items.map((tech) => (
                <div className="list-item-card" key={tech.id}>
                  <div>
                    <div className="item-name">{tech.user.displayName ?? tech.id}</div>
                    <div className="item-subtext">{tech.isVerified ? 'Đã xác minh' : 'Chưa xác minh'} · {tech._count.services} dịch vụ · <span style={{ color: 'var(--gold-500)' }}>★</span> {tech.averageRating.toFixed(2)}</div>
                  </div>
                  <button className="quiet" onClick={() => void patch(`/admin/marketplace/technicians/${tech.id}`, { isActive: !tech.isActive })}>
                    {tech.isActive ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── CATEGORIES ── */}
      {tab === 'categories' && (
        <div className="grid two">
          <Card title="Tạo danh mục">
            <FormCard onSubmit={(event) => {
              const f = form(event);
              void save(event, '/admin/marketplace/categories', { name: f.get('name'), slug: f.get('slug'), iconUrl: f.get('iconUrl') || undefined, sortOrder: Number(f.get('sortOrder') || 0) });
            }}>
              <label>Tên<input name="name" required maxLength={100} /></label>
              <label>Slug<input name="slug" required maxLength={100} /></label>
              <label>Icon URL<input name="iconUrl" type="url" /></label>
              <label>Thứ tự<input name="sortOrder" type="number" min="0" defaultValue="0" /></label>
              <button>Tạo danh mục</button>
            </FormCard>
          </Card>
          <Card title="Danh mục hiện có">
            <div className="item-list">
              {categories.map((cat) => (
                <div className="list-item-card" key={cat.id}>
                  <div>
                    <div className="item-name">{cat.name}</div>
                    <div className="item-subtext">{cat.slug}</div>
                  </div>
                  <button className="quiet" onClick={() => void remove(`/admin/marketplace/categories/${cat.id}`)}>Ẩn</button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── BANNERS ── */}
      {tab === 'banners' && (
        <div className="grid two">
          <Card title="Tạo banner">
            <FormCard onSubmit={(event) => {
              const f = form(event);
              void save(event, '/admin/marketplace/banners', {
                title: f.get('title'), subtitle: f.get('subtitle') || undefined, imageUrl: f.get('imageUrl'),
                actionUrl: f.get('actionUrl') || undefined, sortOrder: Number(f.get('sortOrder') || 0),
                startsAt: f.get('startsAt') ? new Date(String(f.get('startsAt'))).toISOString() : undefined,
                endsAt: f.get('endsAt') ? new Date(String(f.get('endsAt'))).toISOString() : undefined,
              });
            }}>
              <label>Tiêu đề<input name="title" required /></label>
              <label>Ảnh URL<input name="imageUrl" type="url" required /></label>
              <label>Link khi bấm<input name="actionUrl" type="url" /></label>
              <label>Thứ tự<input name="sortOrder" type="number" defaultValue="0" /></label>
              <button>Đăng banner</button>
            </FormCard>
          </Card>
          <Card title="Banner đã tạo">
            <div className="item-list">
              {banners.map((banner) => (
                <div className="list-item-card" key={banner.id}>
                  <div>
                    <div className="item-name">{banner.title}</div>
                    <div className="item-subtext">{banner.isActive ? '✅ Đang hiện' : '⛔ Đang ẩn'} · thứ tự {banner.sortOrder}</div>
                  </div>
                  <div className="button-row">
                    <button className="quiet" onClick={() => void patch(`/admin/marketplace/banners/${banner.id}`, { isActive: !banner.isActive })}>
                      {banner.isActive ? 'Ẩn' : 'Hiện'}
                    </button>
                    <button className="quiet" onClick={() => void remove(`/admin/marketplace/banners/${banner.id}`)}>Xóa</button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── PROMOTIONS ── */}
      {tab === 'promotions' && (
        <div className="grid two">
          <Card title="Tạo voucher">
            <FormCard onSubmit={(event) => {
              const f = form(event);
              void save(event, '/admin/marketplace/promotions', {
                code: f.get('code'), name: f.get('name'), type: f.get('type'), value: Number(f.get('value')),
                minOrderAmount: Number(f.get('minOrderAmount') || 0),
                maxDiscount: f.get('maxDiscount') ? Number(f.get('maxDiscount')) : undefined,
                usageLimit: f.get('usageLimit') ? Number(f.get('usageLimit')) : undefined,
                perUserLimit: Number(f.get('perUserLimit') || 1),
                startsAt: new Date(String(f.get('startsAt'))).toISOString(),
                endsAt: new Date(String(f.get('endsAt'))).toISOString(),
              });
            }}>
              <div className="form-row">
                <label>Mã<input name="code" required /></label>
                <label>Tên<input name="name" required /></label>
              </div>
              <div className="form-row">
                <label>Kiểu<select name="type"><option value="PERCENT">Phần trăm</option><option value="FIXED">Số tiền</option></select></label>
                <label>Giá trị<input name="value" type="number" min="0" required /></label>
              </div>
              <div className="form-row">
                <label>Đơn tối thiểu<input name="minOrderAmount" type="number" min="0" /></label>
                <label>Giảm tối đa<input name="maxDiscount" type="number" min="0" /></label>
              </div>
              <div className="form-row">
                <label>Giới hạn dùng<input name="usageLimit" type="number" min="1" /></label>
                <label>Mỗi khách<input name="perUserLimit" type="number" min="1" defaultValue="1" /></label>
              </div>
              <div className="form-row">
                <label>Bắt đầu<input name="startsAt" type="datetime-local" required /></label>
                <label>Kết thúc<input name="endsAt" type="datetime-local" required /></label>
              </div>
              <button>Tạo voucher</button>
            </FormCard>
          </Card>
          <Card title="Voucher hiện có">
            <div className="item-list">
              {promotions.map((promo) => (
                <div className="list-item-card" key={promo.id}>
                  <div>
                    <div className="item-name" style={{ fontFamily: 'var(--font-mono)' }}>{promo.code} <span style={{ fontFamily: 'var(--font-main)', fontWeight: 500, color: 'var(--text-secondary)' }}>· {promo.name}</span></div>
                    <div className="item-subtext">{promo.type === 'PERCENT' ? `${promo.value}%` : money(promo.value)} · {promo.isActive ? '✅ Đang bật' : '⛔ Đang tắt'}</div>
                  </div>
                  <button className="quiet" onClick={() => void patch(`/admin/marketplace/promotions/${promo.id}`, { isActive: !promo.isActive })}>
                    {promo.isActive ? 'Tắt' : 'Bật'}
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, icon, trend }: { label: string; value: string; icon?: ReactNode; trend?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <div className="kpi-label">{label}</div>
        {icon && <div className="kpi-icon-box">{icon}</div>}
      </div>
      <div className="kpi-value">{value}</div>
      {trend && <div className="kpi-trend positive">↑ {trend}</div>}
    </div>
  );
}
