import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CalendarX, CheckCheck, ChevronRight, MessageCircle, RefreshCw, ShieldAlert, UserCheck } from 'lucide-react';
import { request } from '../api/client';
import { useToast } from '../components/ui/ToastContainer';
import { PageHeader } from '../components/common/PageHeader';
import { Badge, Button, Card, Empty, SkeletonRows, Tabs } from '../components/ui/kit';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};
type NotificationPage = { items: Notification[]; total: number; unreadCount: number; page: number; limit: number };
type Filter = 'all' | 'unread' | 'applications' | 'complaints' | 'orders' | 'messages';

const PAGE_SIZE = 30;
const REFRESH_MS = 60_000;

/** Icon, colour and filter group for each notification type the admin can receive. */
const KIND: Record<string, { group: Exclude<Filter, 'all' | 'unread'>; icon: React.ReactNode; tone: string; label: string }> = {
  ADMIN_APPLICATION_SUBMITTED: { group: 'applications', icon: <UserCheck className="w-4 h-4" />, tone: 'bg-primary-soft text-primary', label: 'Hồ sơ KTV' },
  ADMIN_COMPLAINT_CREATED: { group: 'complaints', icon: <ShieldAlert className="w-4 h-4" />, tone: 'bg-status-dangerBg text-status-danger', label: 'Khiếu nại' },
  ADMIN_BOOKING_EXPIRED: { group: 'orders', icon: <CalendarX className="w-4 h-4" />, tone: 'bg-status-warningBg text-[#B5651D]', label: 'Đơn hàng' },
  CHAT_MESSAGE_RECEIVED: { group: 'messages', icon: <MessageCircle className="w-4 h-4" />, tone: 'bg-status-infoBg text-status-info', label: 'Tin nhắn' },
};
const kindOf = (type: string) =>
  KIND[type] ?? { group: 'orders' as const, icon: <Bell className="w-4 h-4" />, tone: 'bg-surface-muted text-content-secondary', label: 'Hệ thống' };

/** admin://applications → the page; matxa://chat/... → support inbox. */
const targetPage = (notification: Notification) => {
  const url = notification.actionUrl ?? '';
  if (url.startsWith('admin://')) return url.slice('admin://'.length).split(/[/?]/)[0];
  if (url.startsWith('matxa://chat') || notification.type === 'CHAT_MESSAGE_RECEIVED') return 'messages';
  if (url.startsWith('matxa://bookings')) return 'orders';
  return null;
};

const relativeTime = (value: string) => {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'Vừa xong';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.round(hours / 24);
  return days < 7 ? `${days} ngày trước` : new Date(value).toLocaleDateString('vi-VN');
};

export const NotificationsPage: React.FC = () => {
  const { addToast } = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);

  const fetchPage = useCallback(
    async (nextPage: number, append: boolean) => {
      setLoading(true);
      try {
        // Only ever send unreadOnly=true: the API parses the string "false" as true.
        const params = new URLSearchParams({ page: String(nextPage), limit: String(PAGE_SIZE) });
        if (filter === 'unread') params.set('unreadOnly', 'true');
        const result = await request<NotificationPage>(`/notifications?${params}`);
        setItems((current) => (append ? [...current, ...result.items.filter((item) => !current.some((known) => known.id === item.id))] : result.items));
        setTotal(result.total);
        setUnread(result.unreadCount);
        setPage(nextPage);
        setError('');
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Không tải được thông báo');
      } finally {
        setLoading(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    void fetchPage(1, false);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchPage(1, false);
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [fetchPage]);

  const open = async (notification: Notification) => {
    if (!notification.readAt) {
      // Optimistic: the row turns read immediately, reverted only if the API refuses.
      setItems((current) => current.map((item) => (item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item)));
      setUnread((count) => Math.max(0, count - 1));
      request(`/notifications/${notification.id}/read`, { method: 'PATCH' }).catch(() => {
        setItems((current) => current.map((item) => (item.id === notification.id ? notification : item)));
        setUnread((count) => count + 1);
      });
    }
    const page = targetPage(notification);
    if (page) window.location.hash = `/${page}`;
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await request('/notifications/read-all', { method: 'PATCH' });
      const now = new Date().toISOString();
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));
      setUnread(0);
      addToast({ title: 'Đã đánh dấu tất cả đã đọc', type: 'success' });
      if (filter === 'unread') void fetchPage(1, false);
    } catch (markError) {
      addToast({ title: 'Không đánh dấu được', message: markError instanceof Error ? markError.message : undefined, type: 'error' });
    } finally {
      setMarkingAll(false);
    }
  };

  const visible = ['all', 'unread'].includes(filter) ? items : items.filter((item) => kindOf(item.type).group === filter);
  const countIn = (group: Filter) => items.filter((item) => kindOf(item.type).group === group).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thông báo hệ thống"
        subtitle="Hồ sơ KTV mới, khiếu nại, đơn hết hạn và tin nhắn khách gửi tới quản trị viên"
        actions={
          <>
            <Button icon={<RefreshCw className="w-4 h-4" />} loading={loading} onClick={() => void fetchPage(1, false)}>
              Tải lại
            </Button>
            <Button variant="primary" icon={<CheckCheck className="w-4 h-4" />} loading={markingAll} disabled={!unread} onClick={() => void markAllRead()}>
              Đánh dấu tất cả đã đọc
            </Button>
          </>
        }
      />

      <Tabs
        value={filter}
        onChange={setFilter}
        items={[
          { value: 'all', label: 'Tất cả', count: total },
          { value: 'unread', label: 'Chưa đọc', count: unread },
          { value: 'applications', label: 'Hồ sơ KTV', count: countIn('applications') },
          { value: 'complaints', label: 'Khiếu nại', count: countIn('complaints') },
          { value: 'orders', label: 'Đơn hàng', count: countIn('orders') },
          { value: 'messages', label: 'Tin nhắn', count: countIn('messages') },
        ]}
      />

      <Card bodyClassName="p-0">
        {error ? (
          <div role="alert" className="m-4 p-3 rounded-xl bg-status-dangerBg text-[#B9403A] text-sm">Không tải được thông báo: {error}</div>
        ) : loading && !items.length ? (
          <div className="p-4"><SkeletonRows rows={5} /></div>
        ) : !visible.length ? (
          <Empty
            icon={<Bell className="w-6 h-6" />}
            title={filter === 'unread' ? 'Không còn thông báo chưa đọc' : 'Chưa có thông báo'}
            description="Thông báo xuất hiện khi có hồ sơ KTV mới, khiếu nại mới, đơn hết hạn chưa có KTV hoặc khách nhắn tin hỗ trợ."
          />
        ) : (
          <ul className="divide-y divide-surface-borderSubtle">
            <AnimatePresence initial={false}>
              {visible.map((notification, index) => {
                const kind = kindOf(notification.type);
                const isUnread = !notification.readAt;
                const hasTarget = Boolean(targetPage(notification));
                return (
                  <motion.li
                    key={notification.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index, 12) * 0.025 } }}
                    exit={{ opacity: 0 }}
                  >
                    <button
                      onClick={() => void open(notification)}
                      className={`w-full text-left px-5 py-4 flex items-start gap-3 transition-colors group ${isUnread ? 'bg-primary-light/60 hover:bg-primary-light' : 'bg-white hover:bg-surface-subtle'}`}
                    >
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${kind.tone}`}>{kind.icon}</span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm truncate ${isUnread ? 'font-bold text-content-primary' : 'font-medium text-content-secondary'}`}>{notification.title}</span>
                          <Badge>{kind.label}</Badge>
                        </span>
                        <span className="block text-xs text-content-secondary mt-0.5 leading-relaxed line-clamp-2">{notification.body}</span>
                        <span className="block text-[11px] text-content-tertiary mt-1" title={new Date(notification.createdAt).toLocaleString('vi-VN')}>
                          {relativeTime(notification.createdAt)}
                        </span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0 self-center">
                        {isUnread && <span className="w-2.5 h-2.5 rounded-full bg-primary" aria-label="Chưa đọc" />}
                        {hasTarget && <ChevronRight className="w-4 h-4 text-content-tertiary group-hover:text-primary group-hover:translate-x-0.5 transition" />}
                      </span>
                    </button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
        {items.length < total && (
          <div className="p-4 border-t border-surface-borderSubtle text-center">
            <Button size="sm" loading={loading} onClick={() => void fetchPage(page + 1, true)}>
              Xem thêm ({total - items.length})
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default NotificationsPage;
