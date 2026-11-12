import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Copy, HeartHandshake, Lock, Mail, MessageCirclePlus, Phone, RefreshCw, Unlock } from 'lucide-react';
import { request } from '../api/client';
import { useToast } from '../components/ui/ToastContainer';
import { PageHeader } from '../components/common/PageHeader';
import { DetailDrawer } from '../components/common/DetailDrawer';
import { useConfirm } from '../components/ui/useConfirm';
import { CancelOffendersCard } from '../components/CancelOffendersCard';
import { AnimatedNumber, Badge, Button, Card, Empty, Reveal, RevealItem, SearchBox, SkeletonRows, Tabs } from '../components/ui/kit';

type UserStatus = 'ACTIVE' | 'BLOCKED' | 'DELETED';
type Customer = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  email: string | null;
  phoneNumber: string | null;
  providers: string[];
  status: UserStatus;
  createdAt: string;
};
type Page = { items: Customer[]; total: number; page: number; limit: number };

const PAGE_SIZE = 20;
const PROVIDER_LABEL: Record<string, string> = { EMAIL: 'Email', PHONE: 'SĐT', GOOGLE: 'Google', APPLE: 'Apple', FACEBOOK: 'Facebook' };
const STATUS_BADGE: Record<UserStatus, { label: string; tone: 'green' | 'red' | 'gray' }> = {
  ACTIVE: { label: 'Hoạt động', tone: 'green' },
  BLOCKED: { label: 'Đã khóa', tone: 'red' },
  DELETED: { label: 'Đã xóa', tone: 'gray' },
};
const errorText = (error: unknown) => (error instanceof Error ? error.message : 'Không kết nối được máy chủ');

/** Photo when available and loadable, otherwise initials. */
function CustomerAvatar({ src, name, className }: { src?: string | null; name: string; className: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (src && !failed)
    return <img src={src} alt={name} onError={() => setFailed(true)} className={`${className} rounded-full object-cover shrink-0`} />;
  const initials = name.split(/\s+/).filter(Boolean).slice(-2).map((word) => word[0]).join('').toUpperCase() || '?';
  return (
    <div className={`${className} rounded-full shrink-0 bg-primary-soft text-primary font-bold flex items-center justify-center`}>{initials}</div>
  );
}

/** Debounces a value so typing does not fire a request per keystroke. */
function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export const CustomersPage: React.FC = () => {
  const { addToast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'ALL' | UserStatus>('ALL');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [totals, setTotals] = useState({ all: 0, active: 0, blocked: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const query = useDebounced(search.trim());

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ role: 'CUSTOMER', page: String(page), limit: String(PAGE_SIZE) });
    if (query) params.set('search', query);
    if (status !== 'ALL') params.set('status', status);
    try {
      setData(await request<Page>(`/admin/marketplace/users?${params}`));
      setError('');
    } catch (loadError) {
      setError(errorText(loadError));
    } finally {
      setLoading(false);
    }
  }, [page, query, status]);

  const loadTotals = useCallback(async () => {
    const count = (extra: string) =>
      request<Page>(`/admin/marketplace/users?role=CUSTOMER&limit=1${extra}`).then((result) => result.total).catch(() => 0);
    const [all, active, blocked] = await Promise.all([count(''), count('&status=ACTIVE'), count('&status=BLOCKED')]);
    setTotals({ all, active, blocked });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    void loadTotals();
  }, [loadTotals]);
  // A new search or filter starts from the first page.
  useEffect(() => setPage(1), [query, status]);

  const setUserStatus = async (customer: Customer, next: 'ACTIVE' | 'BLOCKED') => {
    if (
      next === 'BLOCKED' &&
      !(await confirm({
        title: 'Khóa tài khoản?',
        message: `${customer.displayName || 'Khách hàng'} sẽ không đăng nhập và đặt lịch được cho tới khi mở khóa.`,
        confirmText: 'Khóa tài khoản',
      }))
    )
      return;
    setBusy(customer.id);
    try {
      await request(`/admin/marketplace/users/${customer.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      const updated = { ...customer, status: next };
      setData((current) => current && { ...current, items: current.items.map((item) => (item.id === customer.id ? updated : item)) });
      setSelected((current) => (current?.id === customer.id ? updated : current));
      void loadTotals();
      addToast({ title: next === 'BLOCKED' ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản', message: customer.displayName ?? customer.id, type: 'success' });
    } catch (statusError) {
      addToast({ title: 'Không đổi được trạng thái', message: errorText(statusError), type: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const openSupportChat = async (customer: Customer) => {
    setBusy(customer.id);
    try {
      await request('/conversations/support', { method: 'POST', body: JSON.stringify({ customerId: customer.id }) });
      window.location.hash = '/messages';
    } catch (chatError) {
      addToast({ title: 'Không mở được chat', message: errorText(chatError), type: 'error' });
    } finally {
      setBusy(null);
    }
  };

  // From the "Hủy đơn nhiều" list, which also holds technicians.
  const blockOffender = async (userId: string, name: string) => {
    if (!(await confirm({ title: 'Khóa tài khoản?', message: `${name} sẽ không đăng nhập, đặt lịch hay nhận đơn được cho tới khi mở khóa.`, confirmText: 'Khóa tài khoản' })))
      return false;
    try {
      await request(`/admin/marketplace/users/${userId}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'BLOCKED' }) });
      addToast({ title: 'Đã khóa tài khoản', message: name, type: 'success' });
      void load();
      void loadTotals();
      return true;
    } catch (statusError) {
      addToast({ title: 'Không đổi được trạng thái', message: errorText(statusError), type: 'error' });
      return false;
    }
  };

  const copyId = (id: string) => {
    void navigator.clipboard?.writeText(id);
    addToast({ title: 'Đã sao chép User ID', message: id, type: 'success' });
  };

  const items = data?.items ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-6">
      {dialog}
      <PageHeader
        title="Khách hàng"
        subtitle="Tìm theo tên, email, số điện thoại hoặc dán User ID"
        actions={
          <Button icon={<RefreshCw className="w-4 h-4" />} loading={loading} onClick={() => { void load(); void loadTotals(); }}>
            Tải lại
          </Button>
        }
      />

      <Reveal className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Tổng khách hàng', value: totals.all, tone: 'bg-primary-soft text-primary', icon: <HeartHandshake className="w-5 h-5" /> },
          { label: 'Đang hoạt động', value: totals.active, tone: 'bg-status-successBg text-status-success', icon: <Unlock className="w-5 h-5" /> },
          { label: 'Đã khóa', value: totals.blocked, tone: 'bg-status-dangerBg text-status-danger', icon: <Lock className="w-5 h-5" /> },
        ].map((stat) => (
          <RevealItem key={stat.label}>
            <div className="p-4 rounded-2xl bg-white border border-surface-border flex items-center gap-3">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.tone}`}>{stat.icon}</span>
              <span>
                <span className="block text-xs text-content-secondary">{stat.label}</span>
                <span className="block text-xl font-bold tabular-nums"><AnimatedNumber value={stat.value} /></span>
              </span>
            </div>
          </RevealItem>
        ))}
      </Reveal>

      <CancelOffendersCard onBlock={blockOffender} />

      <Card bodyClassName="p-0">
        <div className="p-4 flex flex-wrap items-center gap-3 border-b border-surface-borderSubtle">
          <SearchBox value={search} onChange={setSearch} placeholder="Tìm tên, email, SĐT hoặc User ID..." className="flex-1 min-w-[220px]" />
          <Tabs
            value={status}
            onChange={setStatus}
            items={[
              { value: 'ALL', label: 'Tất cả' },
              { value: 'ACTIVE', label: 'Hoạt động' },
              { value: 'BLOCKED', label: 'Đã khóa' },
            ]}
          />
        </div>

        {error ? (
          <div role="alert" className="m-4 p-3 rounded-xl bg-status-dangerBg text-[#B9403A] text-sm">Không tải được khách hàng: {error}</div>
        ) : loading && !data ? (
          <div className="p-4"><SkeletonRows rows={6} /></div>
        ) : !items.length ? (
          <Empty icon={<HeartHandshake className="w-6 h-6" />} title={query || status !== 'ALL' ? 'Không có khách khớp bộ lọc' : 'Chưa có khách hàng'} description={query ? `Không tìm thấy "${query}".` : undefined} />
        ) : (
          <div className={`overflow-x-auto transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-subtle text-[11px] uppercase tracking-wide text-content-secondary">
                <tr>
                  <th className="py-3 px-4 font-semibold">Khách hàng</th>
                  <th className="py-3 px-4 font-semibold">Liên hệ</th>
                  <th className="py-3 px-4 font-semibold">Đăng nhập bằng</th>
                  <th className="py-3 px-4 font-semibold">Tham gia</th>
                  <th className="py-3 px-4 font-semibold">Trạng thái</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-borderSubtle">
                <AnimatePresence initial={false}>
                  {items.map((customer, index) => {
                    const name = customer.displayName || 'Chưa đặt tên';
                    const badge = STATUS_BADGE[customer.status] ?? STATUS_BADGE.ACTIVE;
                    return (
                      <motion.tr
                        key={customer.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { delay: Math.min(index, 10) * 0.02 } }}
                        onClick={() => setSelected(customer)}
                        className="hover:bg-surface-subtle cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <CustomerAvatar src={customer.avatarUrl} name={name} className="w-9 h-9 text-xs" />
                            <div className="min-w-0">
                              <p className={`font-semibold truncate ${customer.displayName ? '' : 'text-content-tertiary italic'}`}>{name}</p>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  copyId(customer.id);
                                }}
                                title="Sao chép User ID"
                                className="text-[11px] font-mono text-content-tertiary hover:text-primary inline-flex items-center gap-1"
                              >
                                {customer.id.slice(0, 8)}… <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-content-secondary">
                          <p>{customer.phoneNumber || '—'}</p>
                          <p className="truncate max-w-[220px]">{customer.email || ''}</p>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {customer.providers.map((provider) => (
                              <Badge key={provider}>{PROVIDER_LABEL[provider] ?? provider}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-content-secondary whitespace-nowrap">{new Date(customer.createdAt).toLocaleDateString('vi-VN')}</td>
                        <td className="py-3 px-4"><Badge tone={badge.tone} dot>{badge.label}</Badge></td>
                        <td className="py-3 px-4 text-right">
                          <ChevronRight className="w-4 h-4 text-content-tertiary inline" />
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > PAGE_SIZE && (
          <div className="p-4 border-t border-surface-borderSubtle flex items-center justify-between gap-3 text-xs text-content-secondary">
            <span>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} / {data.total.toLocaleString('vi-VN')} khách
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" icon={<ChevronLeft className="w-3.5 h-3.5" />} disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Trước</Button>
              <span className="tabular-nums">{page} / {pages}</span>
              <Button size="sm" disabled={page >= pages || loading} onClick={() => setPage((value) => value + 1)}>Sau <ChevronRight className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        )}
      </Card>

      <DetailDrawer
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.displayName || 'Khách hàng'}
        subtitle={selected ? `Tham gia ${new Date(selected.createdAt).toLocaleDateString('vi-VN')}` : ''}
        badge={selected && <Badge tone={STATUS_BADGE[selected.status]?.tone ?? 'gray'} dot>{STATUS_BADGE[selected.status]?.label}</Badge>}
        width="md"
        footer={
          selected && (
            <>
              {selected.status === 'BLOCKED' ? (
                <Button variant="soft" icon={<Unlock className="w-4 h-4" />} loading={busy === selected.id} onClick={() => void setUserStatus(selected, 'ACTIVE')}>Mở khóa</Button>
              ) : (
                <Button variant="danger" icon={<Lock className="w-4 h-4" />} loading={busy === selected.id} onClick={() => void setUserStatus(selected, 'BLOCKED')}>Khóa tài khoản</Button>
              )}
              <Button variant="primary" icon={<MessageCirclePlus className="w-4 h-4" />} disabled={busy !== null || selected.status !== 'ACTIVE'} onClick={() => void openSupportChat(selected)}>
                Nhắn tin hỗ trợ
              </Button>
            </>
          )
        }
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-subtle border border-surface-border">
              <CustomerAvatar src={selected.avatarUrl} name={selected.displayName || '?'} className="w-16 h-16 text-lg ring-2 ring-white" />
              <div className="min-w-0">
                <p className="font-bold text-base truncate">{selected.displayName || 'Chưa đặt tên'}</p>
                <button onClick={() => copyId(selected.id)} className="text-[11px] font-mono text-content-secondary hover:text-primary inline-flex items-center gap-1 break-all text-left">
                  {selected.id} <Copy className="w-3 h-3 shrink-0" />
                </button>
              </div>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" />{selected.phoneNumber || 'Chưa có số điện thoại'}</li>
              <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary" />{selected.email || 'Chưa có email'}</li>
            </ul>
            <div>
              <p className="text-xs font-semibold text-content-secondary mb-1.5">Đăng nhập bằng</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.providers.length ? selected.providers.map((provider) => <Badge key={provider}>{PROVIDER_LABEL[provider] ?? provider}</Badge>) : <span className="text-sm text-content-tertiary">—</span>}
              </div>
            </div>
            <p className="text-xs text-content-secondary leading-relaxed">
              Dùng User ID để gán mã khuyến mãi riêng cho khách này (trang Khuyến mãi → Đối tượng áp dụng).
            </p>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};

export default CustomersPage;
