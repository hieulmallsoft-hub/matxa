import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { AlertCircle, ArrowRight, Lock, Mail } from 'lucide-react';
import { Sidebar, COLLAPSED_WIDTH, EXPANDED_WIDTH } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { MobileNav } from './components/layout/MobileNav';
import { CommandPalette } from './components/layout/CommandPalette';
import { ToastProvider, useToast } from './components/ui/ToastContainer';
import { TopProgress } from './components/ui/TopProgress';
import { BrandLogo, Button, Field, FormError, Input, SkeletonRows } from './components/ui/kit';
// Each page is its own chunk, loaded the first time it is opened.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })));
const OrdersPage = lazy(() => import('./pages/OrdersPage').then((module) => ({ default: module.OrdersPage })));
const CustomersPage = lazy(() => import('./pages/CustomersPage').then((module) => ({ default: module.CustomersPage })));
const ProductsPage = lazy(() => import('./pages/ProductsPage').then((module) => ({ default: module.ProductsPage })));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage').then((module) => ({ default: module.PaymentsPage })));
const TransactionsPage = lazy(() => import('./pages/TransactionsPage').then((module) => ({ default: module.TransactionsPage })));
const MessagesPage = lazy(() => import('./pages/MessagesPage').then((module) => ({ default: module.MessagesPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((module) => ({ default: module.NotificationsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const VenuesPage = lazy(() => import('./pages/VenuesPage').then((module) => ({ default: module.VenuesPage })));
const ContractTemplatesPage = lazy(() => import('./pages/ContractTemplatesPage').then((module) => ({ default: module.ContractTemplatesPage })));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const ComplaintsPage = lazy(() => import('./pages/ComplaintsPage').then((module) => ({ default: module.ComplaintsPage })));
import { usePageRoute } from './hooks/usePageRoute';
import { useAdminCounts } from './hooks/useAdminCounts';
import type { PageId } from './types/dashboard';
import type { AuthResponse, AuthUser, Category } from './types/api';
import { hasAccessToken, onUnauthorized, request, setAccessToken } from './api/client';

const USER_KEY = 'matxa.operations.user';
const COLLAPSE_KEY = 'matxa.operations.sidebarCollapsed';

const storedUser = (): AuthUser | null => {
  if (!hasAccessToken()) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
    return parsed?.role ? parsed : null;
  } catch {
    return null;
  }
};

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
};

function LoginScreen({ onLoggedIn, notice }: { onLoggedIn: (user: AuthUser) => void; notice?: string | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const auth = await request<AuthResponse>('/auth/email/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, deviceId: `operations-web-${Date.now()}` }),
      });
      setAccessToken(auth.accessToken);
      const current = await request<AuthUser>('/auth/me').catch(() => auth.user);
      if (current.role !== 'ADMIN') {
        setAccessToken(null);
        throw new Error('Tài khoản này không có quyền quản trị.');
      }
      localStorage.setItem(USER_KEY, JSON.stringify(current));
      onLoggedIn(current);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message.split(' · ')[0] : 'Không kết nối được máy chủ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-surface-subtle">
      <div className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-[#1C5430] via-primary to-[#41955F] p-12 flex-col justify-between text-white">
        {/* Soft drifting shapes for depth; disabled automatically under reduced motion. */}
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            className="absolute rounded-full bg-white/10 blur-2xl"
            style={{ width: 260 + index * 120, height: 260 + index * 120, left: `${10 + index * 25}%`, top: `${15 + index * 20}%` }}
            animate={{ y: [0, -24, 0], x: [0, 16, 0] }}
            transition={{ duration: 10 + index * 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
        <div className="relative flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
            <BrandLogo className="w-7 h-7 text-white" />
          </span>
          <span className="text-xl font-extrabold tracking-wide">MATXXA</span>
        </div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative space-y-3">
          <h1 className="text-4xl font-extrabold leading-tight">Quản trị Massage & Spa</h1>
          <p className="text-white/80 max-w-md">Theo dõi đơn đặt lịch, duyệt kỹ thuật viên, chăm sóc khách hàng — tất cả ở một nơi.</p>
        </motion.div>
        <p className="relative text-xs text-white/60">© MATXXA</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <motion.form
          onSubmit={(event) => void submit(event)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-sm space-y-5"
        >
          <div className="lg:hidden flex items-center gap-2 mb-2">
            <span className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <BrandLogo className="w-6 h-6 text-white" />
            </span>
            <span className="font-extrabold">MATXXA</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-content-primary">Đăng nhập</h2>
            <p className="text-sm text-content-secondary mt-1">Dùng tài khoản quản trị viên.</p>
          </div>
          {notice && <p className="p-3 rounded-xl bg-status-warningBg border border-[#FBE3B8] text-xs text-[#A86A0C]">{notice}</p>}
          <Field label={<span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-primary" /> Email</span>} required>
            <Input type="email" required autoComplete="username" autoFocus value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@congty.vn" />
          </Field>
          <Field label={<span className="inline-flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-primary" /> Mật khẩu</span>} required>
            <Input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          <FormError message={error} />
          <Button type="submit" variant="primary" loading={loading} className="w-full">
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'} {!loading && <ArrowRight className="w-4 h-4" />}
          </Button>
        </motion.form>
      </div>
    </div>
  );
}

function AppInner() {
  const { addToast } = useToast();
  const [currentPage, navigate] = usePageRoute();
  const [user, setUser] = useState<AuthUser | null>(storedUser);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [theme, setTheme] = useState('light');
  const { counts, refresh: refreshCounts } = useAdminCounts(Boolean(user));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const logout = useCallback((notice: string | null = null) => {
    setAccessToken(null);
    localStorage.removeItem(USER_KEY);
    setSessionNotice(notice);
    setUser(null);
  }, []);

  useEffect(() => onUnauthorized(() => logout('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')), [logout]);

  const toggleCollapsed = () =>
    setIsCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, value ? '0' : '1');
      } catch {
        // Preference only; ignore storage failures.
      }
      return !value;
    });

  const go = useCallback(
    (page: PageId) => {
      navigate(page);
      setIsMobileMenuOpen(false);
      // Work queues change as the admin acts; refresh badges on every page switch.
      void refreshCounts();
    },
    [navigate, refreshCounts],
  );

  const refreshCategories = useCallback(async () => {
    await request<Category[]>('/marketplace/categories').catch(() => undefined);
  }, []);

  const handleAction = useCallback(
    (action: string) => {
      const target: Record<string, PageId> = {
        'new-report': 'analytics',
        'create-order': 'orders',
        'view-bookings': 'orders',
        'confirm-booking': 'orders',
        'view-schedule': 'orders',
        'add-service': 'catalog',
        'create-promotion': 'promotions',
        'add-customer': 'customers',
        'view-applications': 'applications',
        'view-messages': 'messages',
        'view-complaints': 'complaints',
      };
      if (action === 'new-report') setIsReportModalOpen(true);
      else if (target[action]) go(target[action]);
    },
    [go],
  );

  if (!user)
    return (
      <LoginScreen
        notice={sessionNotice}
        onLoggedIn={(next) => {
          setSessionNotice(null);
          setUser(next);
          addToast({ title: 'Đăng nhập thành công', message: `Xin chào ${next.name || next.email || ''}`, type: 'success' });
        }}
      />
    );

  const renderPage = () => {
    switch (currentPage) {
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
        return <SettingsPage theme={theme} onToggleTheme={setTheme} />;
      case 'technicianPolicy':
        return <SettingsPage theme={theme} onToggleTheme={setTheme} initialCategory="technician" />;
      case 'complaints':
        return <ComplaintsPage />;
      case 'venues':
        return <VenuesPage />;
      case 'contracts':
        return <ContractTemplatesPage />;
      case 'technicians':
      case 'applications':
      case 'catalog':
      case 'courses':
      case 'promotions':
        return (
          <AdminDashboard
            notify={(message, isError) =>
              addToast({ title: isError ? 'Có lỗi xảy ra' : 'Thành công', message, type: isError ? 'error' : 'success' })
            }
            refreshCategories={refreshCategories}
            tab={currentPage}
            setTab={(tab) => go(tab as PageId)}
            refreshKey={0}
          />
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
    <div className="min-h-screen bg-surface-subtle text-content-primary flex antialiased">
      <TopProgress />
      <Sidebar
        currentPage={currentPage}
        onNavigate={go}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapsed}
        counts={counts}
        healthy={counts.healthy}
      />
      <MobileNav isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} currentPage={currentPage} onNavigate={go} counts={counts} />

      <div
        style={{ '--sidebar-w': `${isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH}px` } as React.CSSProperties}
        className="flex-1 flex flex-col min-w-0 md:pl-[var(--sidebar-w)] transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
      >
        <Navbar
          currentPage={currentPage}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onNavigate={go}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          counts={counts}
          user={user}
          onLogout={() => logout()}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <Suspense fallback={<SkeletonRows rows={6} />}>{renderPage()}</Suspense>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <CommandPalette isOpen={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} onNavigate={go} />
    </div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </MotionConfig>
  );
}
