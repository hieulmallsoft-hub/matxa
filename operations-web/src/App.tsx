import { useCallback, useEffect, useState } from 'react';
import { request, setAccessToken } from './api/client';
import { LoginForm } from './components/LoginForm';
import { Notice } from './components/Notice';
import { AdminDashboard } from './pages/AdminDashboard';
import { TechnicianDashboard } from './pages/TechnicianDashboard';
import type { AuthResponse, AuthUser, Category } from './types/api';
import { Sparkles, LogOut, Shield, UserCircle, Loader2 } from 'lucide-react';

const storedUser = () => {
  try {
    return JSON.parse(localStorage.getItem('matxa.operations.user') || 'null') as AuthUser | null;
  } catch {
    return null;
  }
};

const DEFAULT_MOCK_CATEGORIES: Category[] = [
  { id: 'cat-01', name: 'Massage Cổ Vai Gáy', slug: 'massage-co-vai-gay' },
  { id: 'cat-02', name: 'Massage Body Đá Nóng', slug: 'massage-body-da-nong' },
  { id: 'cat-03', name: 'Massage Bấm Huyệt Shiatsu', slug: 'massage-shiatsu' },
  { id: 'cat-04', name: 'Massage Trị Liệu Thể Thao', slug: 'massage-the-thao' },
  { id: 'cat-05', name: 'Gội Đầu Dưỡng Sinh Thảo Dược', slug: 'goi-dau-duong-sinh' },
];

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(storedUser);
  const [checkingSession, setCheckingSession] = useState(false);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_MOCK_CATEGORIES);
  const [notice, setNotice] = useState<{ message: string; error?: boolean } | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date().toLocaleTimeString('vi-VN'));

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('vi-VN'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const notify = useCallback((message: string, error = false) => {
    setNotice({ message, error });
  }, []);

  const refreshCategories = useCallback(async () => {
    try {
      const data = await request<Category[]>('/marketplace/categories');
      if (data && data.length > 0) {
        setCategories(data);
      }
    } catch {
      // Keep existing default categories
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void refreshCategories();
  }, [user?.id, refreshCategories]);

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

  function handleMockLogin(demoUser: AuthUser, token: string) {
    setAccessToken(token);
    localStorage.setItem('matxa.operations.user', JSON.stringify(demoUser));
    setUser(demoUser);
    notify(`Đã đăng nhập thành công vào vai ${demoUser.role === 'ADMIN' ? 'Admin' : 'Kỹ thuật viên'}!`);
  }

  function logout() {
    setAccessToken(null);
    localStorage.removeItem('matxa.operations.user');
    setUser(null);
    setNotice(null);
  }

  return (
    <>
      {/* Ambient background light orbs */}
      <div className="ambient-glow ambient-glow-1" />
      <div className="ambient-glow ambient-glow-2" />

      {/* Floating toast notification */}
      <Notice
        message={notice?.message || null}
        error={notice?.error}
        onClose={() => setNotice(null)}
      />

      <main className="shell">
        {checkingSession ? (
          <div className="login-container">
            <section className="login-card" style={{ textAlign: 'center' }}>
              <div className="login-logo">
                <Loader2 size={32} className="animate-spin" />
              </div>
              <p className="eyebrow" style={{ justifyContent: 'center' }}>
                MATXA OPERATIONS
              </p>
              <h1>Đang xác minh phiên...</h1>
              <p className="muted">Hệ thống đang kết nối và đồng bộ dữ liệu bảo mật.</p>
            </section>
          </div>
        ) : !user ? (
          <LoginForm onSuccess={login} onMockLogin={handleMockLogin} />
        ) : user.role === 'CUSTOMER' ? (
          <div className="login-container">
            <section className="login-card" style={{ textAlign: 'center' }}>
              <div className="login-logo" style={{ background: 'linear-gradient(135deg, #ef4444, #991b1b)' }}>
                <Shield size={32} />
              </div>
              <p className="eyebrow" style={{ justifyContent: 'center', color: '#f87171' }}>
                TRUY CẬP BỊ TỪ CHỐI
              </p>
              <h1>Không có quyền truy cập</h1>
              <p className="muted" style={{ marginBottom: '24px' }}>
                Tài khoản khách hàng (CUSTOMER) không có quyền truy cập vào cổng vận hành Admin & KTV.
              </p>
              <button onClick={logout} className="secondary" style={{ margin: '0 auto' }}>
                <LogOut size={16} /> Đăng xuất tài khoản
              </button>
            </section>
          </div>
        ) : (
          <>
            {/* Luxury Topbar Header */}
            <header className="topbar">
              <div className="brand-wrapper">
                <div className="brand-icon-box">
                  <Sparkles size={24} />
                </div>
                <div>
                  <p className="eyebrow">MATXA SPA & WELLNESS OPERATIONS</p>
                  <h1 className="brand-title">
                    {user.role === 'ADMIN' ? 'Trung Tâm Điều Hành & Quản Trị' : 'Không Gian Chuyên Viên Trị Liệu'}
                  </h1>
                </div>
              </div>

              <div className="header-right">
                <div className="live-indicator">
                  <div className="pulse-dot" />
                  <span>Trực tuyến • {currentTime}</span>
                </div>

                <div className="account-pill">
                  <UserCircle size={20} className="card-icon" />
                  <span className="account-name">
                    {user.name || user.email || user.id.slice(0, 8)}
                  </span>
                  <span className={`role-badge ${user.role === 'ADMIN' ? 'admin' : ''}`}>
                    {user.role === 'ADMIN' ? '👑 Admin' : '💆 KTV'}
                  </span>
                  <button
                    className="quiet"
                    onClick={logout}
                    title="Đăng xuất"
                    style={{ marginLeft: '4px', padding: '6px 10px' }}
                  >
                    <LogOut size={14} />
                  </button>
                </div>
              </div>
            </header>

            {/* Main Content View */}
            {user.role === 'ADMIN' ? (
              <AdminDashboard notify={notify} refreshCategories={refreshCategories} />
            ) : (
              <TechnicianDashboard categories={categories} notify={notify} />
            )}
          </>
        )}
      </main>
    </>
  );
}
