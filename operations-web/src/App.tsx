import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { MobileNav } from './components/layout/MobileNav';
import { CommandPalette } from './components/layout/CommandPalette';
import { ToastProvider, useToast } from './components/ui/ToastContainer';
import { DashboardPage } from './pages/DashboardPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { OrdersPage } from './pages/OrdersPage';
import { CustomersPage } from './pages/CustomersPage';
import { ProductsPage } from './pages/ProductsPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { MessagesPage } from './pages/MessagesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminDashboard } from './pages/AdminDashboard';
import { INITIAL_NOTIFICATIONS } from './data/mockData';
import { PageId, NotificationItem } from './types/dashboard';
import type { AuthResponse, AuthUser, Category } from './types/api';
import { request, setAccessToken } from './api/client';
import { Sparkles, Key, Mail, Lock, ArrowRight, X, AlertCircle } from 'lucide-react';

const storedUser = (): AuthUser => {
  try {
    const raw = localStorage.getItem('matxa.operations.user');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.role) return parsed;
    }
  } catch {
    // fallback
  }
  // Default active Commander session for immediate preview & operational readiness
  return {
    id: 'admin-commander-01',
    email: 'admin@psyocore.io',
    name: 'Commander Ops',
    role: 'ADMIN',
    status: 'ACTIVE',
  };
};

function AppInner() {
  const { addToast } = useToast();
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => !localStorage.getItem('matxa.operations.token'));
  const [user, setUser] = useState<AuthUser>(storedUser);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [theme, setTheme] = useState('dark');
  const [refreshKey, setRefreshKey] = useState(0);

  // Keyboard shortcut for Command Palette (⌘K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const refreshCategories = useCallback(async () => {
    await request<Category[]>('/marketplace/categories').catch(() => undefined);
  }, []);

  const handleAction = useCallback(
    (actionName: string) => {
      if (actionName === 'new-report') {
        setIsReportModalOpen(true);
      } else if (actionName === 'create-order') {
        setCurrentPage('orders');
        addToast({
          title: 'Tạo đơn mới',
          message: 'Vui lòng điền thông tin khách hàng và dịch vụ tại biểu mẫu.',
          type: 'info',
        });
      } else {
        addToast({
          title: 'Hành động kích hoạt',
          message: `Thao tác "${actionName}" đã được xử lý thành công.`,
          type: 'success',
        });
      }
    },
    [addToast],
  );

  const handleMarkNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    addToast({
      title: 'Đã đánh dấu đọc',
      message: 'Tất cả thông báo đã được lưu trữ.',
      type: 'info',
    });
  }, [addToast]);

  const handleToggleDemoMode = useCallback(() => {
    setIsDemoMode((prev) => {
      const next = !prev;
      addToast({
        title: next ? 'Chế độ Demo Sandbox' : 'Chế độ Live API',
        message: next
          ? 'Đang sử dụng dữ liệu mô phỏng thời gian thực.'
          : 'Đang kết nối API máy chủ NestJS nội bộ.',
        type: 'info',
      });
      return next;
    });
  }, [addToast]);

  const handleLogout = useCallback(() => {
    setAccessToken(null);
    localStorage.removeItem('matxa.operations.user');
    localStorage.removeItem('matxa.operations.token');
    setUser(storedUser());
    setIsDemoMode(true);
    addToast({
      title: 'Đã đăng xuất',
      message: 'Đã trở về chế độ Demo Sandbox mặc định.',
      type: 'info',
    });
  }, [addToast]);

  // Login submission inside Login Modal
  const [loginEmail, setLoginEmail] = useState('admin@matxa.local');
  const [loginPassword, setLoginPassword] = useState('12345678');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const auth = await request<AuthResponse>('/auth/email/login', {
        method: 'POST',
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
          deviceId: `operations-web-${Date.now()}`,
        }),
      });
      setAccessToken(auth.accessToken);
      localStorage.setItem('matxa.operations.token', auth.accessToken);
      try {
        const currentUser = await request<AuthUser>('/auth/me');
        localStorage.setItem('matxa.operations.user', JSON.stringify(currentUser));
        setUser(currentUser);
      } catch {
        localStorage.setItem('matxa.operations.user', JSON.stringify(auth.user));
        setUser(auth.user);
      }
      setIsDemoMode(false);
      setIsLoginModalOpen(false);
      addToast({
        title: 'Đăng nhập thành công',
        message: `Chào mừng quản trị viên ${auth.user.name || auth.user.email || ''}!`,
        type: 'success',
      });
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Không thể kết nối đến máy chủ xác thực');
    } finally {
      setLoginLoading(false);
    }
  };

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <DashboardPage
            onTriggerAction={handleAction}
            onOpenReportModal={() => setIsReportModalOpen(true)}
            isReportModalOpen={isReportModalOpen}
            onCloseReportModal={() => setIsReportModalOpen(false)}
          />
        );
      case 'analytics':
        return <AnalyticsPage />;
      case 'orders':
        return <OrdersPage />;
      case 'customers':
        return <CustomersPage />;
      case 'products':
        return <ProductsPage />;
      case 'payments':
        return <PaymentsPage />;
      case 'transactions':
        return <TransactionsPage />;
      case 'messages':
        return <MessagesPage />;
      case 'notifications':
        return <NotificationsPage />;
      case 'settings':
        return <SettingsPage theme={theme} onToggleTheme={(t) => setTheme(t)} />;
      case 'technicians':
      case 'applications':
      case 'catalog':
      case 'courses':
      case 'promotions':
        return (
          <div className="bg-[#0D111E]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-2xl">
            <AdminDashboard
              notify={(msg, isErr) =>
                addToast({
                  title: isErr ? 'Thông báo hệ thống' : 'Thành công',
                  message: msg,
                  type: isErr ? 'error' : 'success',
                })
              }
              refreshCategories={refreshCategories}
              tab={currentPage}
              setTab={(t) => setCurrentPage(t as PageId)}
              refreshKey={refreshKey}
            />
          </div>
        );
      default:
        return (
          <DashboardPage
            onTriggerAction={handleAction}
            onOpenReportModal={() => setIsReportModalOpen(true)}
            isReportModalOpen={isReportModalOpen}
            onCloseReportModal={() => setIsReportModalOpen(false)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#07080D] text-[#F8FAFC] flex font-sans antialiased selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* 1. Left Desktop Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={(p) => setCurrentPage(p)}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        unreadNotifications={notifications.filter((n) => !n.read).length}
        unreadMessages={3}
      />

      {/* 2. Mobile Drawer Navigation */}
      <MobileNav
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        currentPage={currentPage}
        onNavigate={(p) => {
          setCurrentPage(p);
          setIsMobileMenuOpen(false);
        }}
      />

      {/* 3. Main Workspace Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          isCollapsed ? 'md:ml-20' : 'md:ml-[260px]'
        }`}
      >
        {/* Top Navbar */}
        <Navbar
          currentPage={currentPage}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onNavigate={(p) => setCurrentPage(p)}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          notifications={notifications}
          onMarkNotificationsRead={handleMarkNotificationsRead}
          theme={theme}
          onToggleTheme={(t) => setTheme(t)}
          user={user}
          isDemoMode={isDemoMode}
          onToggleDemoMode={handleToggleDemoMode}
          onOpenLoginModal={() => setIsLoginModalOpen(true)}
          onLogout={handleLogout}
        />

        {/* Page Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {renderCurrentPage()}
        </main>
      </div>

      {/* 4. Global Command Palette Modal (Cmd+K / Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(p) => setCurrentPage(p)}
        onTriggerAction={handleAction}
      />

      {/* 5. Live Backend Authentication Modal */}
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-[#0D101E] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6">
            <button
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-indigo-500/20 text-cyan-400 border border-indigo-500/30">
                <Sparkles className="w-3.5 h-3.5" /> MATXA LUXURY OPERATIONS
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Kết nối Live API</h2>
              <p className="text-xs text-slate-400">
                Nhập tài khoản Quản trị viên để đồng bộ dữ liệu trực tiếp với backend máy chủ.
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-cyan-400" /> Email quản trị
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@matxa.local"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-violet-400" /> Mật khẩu
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
                />
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-500 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {loginLoading ? 'Đang xác thực...' : 'Đăng nhập vào hệ thống'}
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsDemoMode(true);
                    setIsLoginModalOpen(false);
                    addToast({
                      title: 'Chế độ Demo Sandbox',
                      message: 'Tiếp tục trải nghiệm giao diện hoàn chỉnh với dữ liệu mô phỏng.',
                      type: 'info',
                    });
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium transition-colors"
                >
                  Dùng chế độ Demo Sandbox không cần đăng nhập
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
