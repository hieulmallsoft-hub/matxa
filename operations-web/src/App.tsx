import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { request, setAccessToken } from './api/client';
import { LoginForm } from './components/LoginForm';
import { Notice } from './components/Notice';
import { AdminDashboard } from './pages/AdminDashboard';
import type { AuthResponse, AuthUser, Category } from './types/api';
import {
  Sparkles,
  LogOut,
  Shield,
  UserCircle,
  LayoutDashboard,
  Users,
  CalendarCheck,
  UserCheck,
  FolderTree,
  Image as ImageIcon,
  TicketPercent,
  ClipboardCheck,
  DollarSign,
  RefreshCw,
} from 'lucide-react';

const storedUser = () => {
  try {
    return JSON.parse(localStorage.getItem('matxa.operations.user') || 'null') as AuthUser | null;
  } catch {
    return null;
  }
};

type TabKey =
  | 'overview'
  | 'users'
  | 'bookings'
  | 'applications'
  | 'technicians'
  | 'pricing'
  | 'categories'
  | 'banners'
  | 'promotions';

const TAB_LABELS: Record<TabKey, string> = {
  overview: 'Tổng quan',
  users: 'Tài khoản',
  bookings: 'Lịch đặt',
  technicians: 'Kỹ thuật viên',
  pricing: 'Bảng giá KTV',
  applications: 'Duyệt KTV',
  categories: 'Danh mục',
  banners: 'Banner',
  promotions: 'Khuyến mãi',
};

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(storedUser);
  const [notice, setNotice] = useState<{ message: string; error?: boolean } | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date().toLocaleTimeString('vi-VN'));
  const [tab, setTab] = useState<TabKey>('overview');
  const [refreshKey, setRefreshKey] = useState(0);
  const notify = useCallback((message: string, error = false) => setNotice({ message, error }), []);
  const refreshCategories = useCallback(async () => {
    await request<Category[]>('/marketplace/categories').catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString('vi-VN')), 1000);
    return () => clearInterval(timer);
  }, []);

  async function login(auth: AuthResponse) {
    setAccessToken(auth.accessToken);
    try {
      const currentUser = await request<AuthUser>('/auth/me');
      localStorage.setItem('matxa.operations.user', JSON.stringify(currentUser));
      setUser(currentUser);
      notify(`Xin chào, ${currentUser.name || currentUser.email || 'Quản trị viên'}!`);
    } catch {
      localStorage.setItem('matxa.operations.user', JSON.stringify(auth.user));
      setUser(auth.user);
      notify(`Xin chào, ${auth.user.name || auth.user.email || 'Quản trị viên'}!`);
    }
  }

  function logout() {
    setAccessToken(null);
    localStorage.removeItem('matxa.operations.user');
    setUser(null);
    setNotice(null);
  }

  const userInitial = user?.name?.slice(0, 1) ?? user?.email?.slice(0, 1) ?? '?';

  // Nav items
  const navMain: { key: TabKey; label: string; icon: ReactNode }[] = [
    { key: 'overview', label: 'Tổng quan', icon: <LayoutDashboard size={17} /> },
    { key: 'users', label: 'Tài khoản', icon: <Users size={17} /> },
    { key: 'bookings', label: 'Lịch đặt', icon: <CalendarCheck size={17} /> },
    { key: 'technicians', label: 'Kỹ thuật viên', icon: <UserCheck size={17} /> },
    { key: 'pricing', label: 'Bảng giá KTV', icon: <DollarSign size={17} /> },
    { key: 'applications', label: 'Duyệt KTV', icon: <ClipboardCheck size={17} /> },
  ];

  const navContent: { key: TabKey; label: string; icon: ReactNode }[] = [
    { key: 'categories', label: 'Danh mục', icon: <FolderTree size={17} /> },
    { key: 'banners', label: 'Banner', icon: <ImageIcon size={17} /> },
    { key: 'promotions', label: 'Khuyến mãi', icon: <TicketPercent size={17} /> },
  ];

  if (!user)
    return (
      <>
        <Notice message={notice?.message || null} error={notice?.error} onClose={() => setNotice(null)} />
        <LoginForm onSuccess={login} />
      </>
    );

  if (user.role !== 'ADMIN')
    return (
      <>
        <Notice message={notice?.message || null} error={notice?.error} onClose={() => setNotice(null)} />
        <div className="login-container">
          <section className="login-card">
            <div className="login-header">
              <div className="login-logo" style={{ background: 'linear-gradient(135deg, #ef4444, #991b1b)' }}>
                <Shield size={32} />
              </div>
              <p className="eyebrow" style={{ justifyContent: 'center', color: '#dc2626' }}>
                TRUY CẬP BỊ TỪ CHỐI
              </p>
              <h1>Không có quyền truy cập</h1>
              <p>Cổng Operations chỉ dành cho Quản trị viên. KTV quản lý hồ sơ và nhận đơn trên ứng dụng Mobile.</p>
            </div>
            <button onClick={logout} className="secondary" style={{ width: '100%', marginTop: '8px' }}>
              <LogOut size={16} />
              Đăng xuất
            </button>
          </section>
        </div>
      </>
    );

  return (
    <>
      <Notice message={notice?.message || null} error={notice?.error} onClose={() => setNotice(null)} />
      <div className="app-layout">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <Sparkles size={22} />
            </div>
            <div className="sidebar-logo-text">
              <div className="sidebar-logo-name">Matxa Ops</div>
              <div className="sidebar-logo-sub">Operations Portal</div>
            </div>
          </div>

          <nav className="sidebar-nav">
            <div className="sidebar-section-label">Quản lý</div>
            {navMain.map(({ key, label, icon }) => (
              <button key={key} className={`sidebar-item ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
                <span className="sidebar-item-icon">{icon}</span>
                {label}
              </button>
            ))}

            <div className="sidebar-section-label" style={{ marginTop: '8px' }}>
              Nội dung
            </div>
            {navContent.map(({ key, label, icon }) => (
              <button key={key} className={`sidebar-item ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
                <span className="sidebar-item-icon">{icon}</span>
                {label}
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-user">
              <div className="sidebar-avatar">{userInitial.toUpperCase()}</div>
              <div className="sidebar-user-info">
                <div className="sidebar-user-name">{user.name || user.email || 'Admin'}</div>
                <div className="sidebar-user-role">👑 Admin</div>
              </div>
              <button className="sidebar-logout" onClick={logout} title="Đăng xuất">
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="main-area">
          {/* Topbar */}
          <header className="topbar">
            <div className="topbar-left">
              <span className="topbar-page-label">Matxa Spa &amp; Wellness Operations</span>
              <span className="topbar-page-title">{TAB_LABELS[tab]}</span>
            </div>
            <div className="topbar-right">
              <div className="live-indicator">
                <div className="pulse-dot" />
                <span>Trực tuyến • {currentTime}</span>
              </div>
              <button
                className="topbar-refresh-btn"
                onClick={() => setRefreshKey((k) => k + 1)}
                title="Làm mới dữ liệu"
              >
                <RefreshCw size={14} />
                Làm mới
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserCircle size={20} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {user.name || user.email || user.id.slice(0, 8)}
                </span>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className="page-content">
            <AdminDashboard
              notify={notify}
              refreshCategories={refreshCategories}
              tab={tab}
              setTab={setTab}
              refreshKey={refreshKey}
            />
          </main>
        </div>
      </div>
    </>
  );
}
