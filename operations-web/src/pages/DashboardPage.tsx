import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  Star,
  UserCheck,
  UsersRound,
} from 'lucide-react';
import { request } from '../api/client';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { AnimatedNumber, Badge, Button, Card, Empty, Reveal, RevealItem, SkeletonRows } from '../components/ui/kit';

interface DashboardPageProps {
  onTriggerAction: (action: string) => void;
  // Kept for the shell's existing wiring; the report modal is no longer shown here.
  onOpenReportModal?: () => void;
  isReportModalOpen?: boolean;
  onCloseReportModal?: () => void;
}

type DashboardStats = {
  todayBookings?: number;
  activeTechnicians?: number;
  averageRating?: number;
  reviewCount?: number;
  completedBookingsThisMonth?: number;
  revenueThisMonth?: number;
};

type BookingRow = {
  id: string;
  status: string;
  scheduledStart?: string;
  totalAmount?: number | string;
  customer?: { displayName?: string | null };
  technician?: { user?: { displayName?: string | null } } | null;
  items?: Array<{ serviceName?: string }>;
};

const STATUSES = [
  { key: 'PENDING', label: 'Chờ KTV nhận', color: '#F2A93B', tone: 'amber' as const },
  { key: 'CONFIRMED', label: 'Đã xác nhận', color: '#4285D4', tone: 'blue' as const },
  { key: 'COMPLETED', label: 'Hoàn thành', color: '#2E9B62', tone: 'green' as const },
  { key: 'CANCELLED', label: 'Đã hủy', color: '#B3C1B7', tone: 'gray' as const },
];
const STATUS_LABEL: Record<string, { label: string; tone: 'amber' | 'blue' | 'green' | 'gray' | 'red' }> = {
  ...Object.fromEntries(STATUSES.map((status) => [status.key, { label: status.label, tone: status.tone }])),
  OPEN: { label: 'Đang tìm KTV', tone: 'amber' },
  EXPIRED: { label: 'Hết hạn', tone: 'gray' },
};

const money = (value: number) => `${Math.round(value).toLocaleString('vi-VN')} đ`;
const greeting = () => {
  const hour = new Date().getHours();
  return hour < 11 ? 'Chào buổi sáng' : hour < 14 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
};

/** Everything on this page comes from the API; a failed source shows as unavailable, never as sample data. */
function useDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [byStatus, setByStatus] = useState<Record<string, number> | null>(null);
  const [recent, setRecent] = useState<BookingRow[] | null>(null);
  const [queues, setQueues] = useState({ applications: 0, support: 0, complaints: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const total = (path: string) => request<{ total?: number }>(path).then((page) => page?.total ?? 0);
    const [statsResult, statusResult, recentResult, applications, support, complaints] = await Promise.allSettled([
      request<DashboardStats>('/admin/marketplace/dashboard'),
      Promise.all(STATUSES.map((status) => total(`/admin/marketplace/bookings?status=${status.key}&limit=1`))),
      request<{ items?: BookingRow[] }>('/admin/marketplace/bookings?limit=8'),
      total('/admin/marketplace/technician-applications?status=SUBMITTED&limit=1'),
      request<Array<{ unreadCount?: number }>>('/conversations?type=SUPPORT'),
      request<unknown[]>('/admin/complaints?status=SUBMITTED'),
    ]);
    setStats(statsResult.status === 'fulfilled' ? statsResult.value : null);
    setByStatus(
      statusResult.status === 'fulfilled'
        ? Object.fromEntries(STATUSES.map((status, index) => [status.key, statusResult.value[index]]))
        : null,
    );
    setRecent(recentResult.status === 'fulfilled' ? (recentResult.value.items ?? []) : null);
    setQueues({
      applications: applications.status === 'fulfilled' ? applications.value : 0,
      support: support.status === 'fulfilled' ? support.value.reduce((sum, item) => sum + (item.unreadCount ?? 0), 0) : 0,
      complaints: complaints.status === 'fulfilled' ? (complaints.value ?? []).length : 0,
      pending: statusResult.status === 'fulfilled' ? statusResult.value[0] : 0,
    });
    const failed = [statsResult, statusResult, recentResult].find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined;
    setError(failed ? (failed.reason instanceof Error ? failed.reason.message : 'Không tải được dữ liệu') : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  return { stats, byStatus, recent, queues, loading, error, load };
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onTriggerAction }) => {
  const { stats, byStatus, recent, queues, loading, error, load } = useDashboard();
  const statusTotal = byStatus ? Object.values(byStatus).reduce((sum, value) => sum + value, 0) : 0;
  const chartData = byStatus ? STATUSES.map((status) => ({ ...status, value: byStatus[status.key] ?? 0 })).filter((item) => item.value > 0) : [];
  const tasks = [
    { key: 'pending', count: queues.pending, label: 'Đơn chờ KTV nhận', icon: <CalendarClock className="w-4 h-4" />, action: 'view-bookings' },
    { key: 'applications', count: queues.applications, label: 'Hồ sơ KTV chờ duyệt', icon: <UserCheck className="w-4 h-4" />, action: 'view-applications' },
    { key: 'support', count: queues.support, label: 'Tin nhắn CSKH chưa đọc', icon: <MessageCircle className="w-4 h-4" />, action: 'view-messages' },
    { key: 'complaints', count: queues.complaints, label: 'Khiếu nại mới', icon: <ShieldAlert className="w-4 h-4" />, action: 'view-complaints' },
  ];
  const waiting = tasks.reduce((sum, task) => sum + task.count, 0);
  const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <PageHeader
        title={greeting()}
        subtitle={`Tình hình vận hành ${today}`}
        actions={
          <Button icon={<RefreshCw className="w-4 h-4" />} loading={loading} onClick={() => void load()}>
            Tải lại
          </Button>
        }
      />

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-status-dangerBg border border-[#F8D2D0] text-[#B9403A] text-sm">
          Một phần dữ liệu không tải được: {error}
        </div>
      )}

      <Reveal className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <RevealItem>
          <StatCard label="Đơn đặt hôm nay" value={stats?.todayBookings ?? 0} caption="theo giờ hẹn trong ngày" icon={<CalendarDays className="w-5 h-5" />} tone="primary" onClick={() => onTriggerAction('view-bookings')} />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Doanh thu tháng này"
            value={stats ? money(stats.revenueThisMonth ?? 0) : '—'}
            caption={`hoa hồng từ ${stats?.completedBookingsThisMonth ?? 0} đơn hoàn thành`}
            icon={<CircleDollarSign className="w-5 h-5" />}
            tone="success"
          />
        </RevealItem>
        <RevealItem>
          <StatCard label="KTV đang hoạt động" value={stats?.activeTechnicians ?? 0} caption="đã xác minh, đang bật" icon={<UsersRound className="w-5 h-5" />} tone="info" />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Đánh giá trung bình"
            value={stats?.reviewCount ? `${(stats.averageRating ?? 0).toFixed(2)} ★` : 'Chưa có'}
            caption={`${(stats?.reviewCount ?? 0).toLocaleString('vi-VN')} đánh giá`}
            icon={<Star className="w-5 h-5" />}
            tone="warning"
          />
        </RevealItem>
      </Reveal>

      <Card
        title={
          <span className="inline-flex items-center gap-2">
            Việc cần xử lý
            {waiting > 0 && <Badge tone="amber">{waiting} việc</Badge>}
          </span>
        }
        subtitle="Bấm để đi tới đúng trang xử lý"
      >
        {waiting === 0 && !loading ? (
          <div className="flex items-center gap-3 text-sm text-content-secondary">
            <CheckCircle2 className="w-5 h-5 text-status-success" /> Không có việc tồn đọng. Mọi thứ đang ổn!
          </div>
        ) : (
          <Reveal className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {tasks.map((task) => (
              <RevealItem key={task.key}>
                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onTriggerAction(task.action)}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-center gap-3 group transition-colors ${
                    task.count ? 'bg-[#FFFAF2] border-[#FBE3B8] hover:border-[#F2A93B]' : 'bg-white border-surface-border hover:border-[#D0DCD1]'
                  }`}
                >
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${task.count ? 'bg-[#FEF0E2] text-[#B5651D]' : 'bg-surface-subtle text-content-tertiary'}`}>
                    {task.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xl font-bold tabular-nums">
                      <AnimatedNumber value={task.count} />
                    </span>
                    <span className="block text-[11px] text-content-secondary truncate">{task.label}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-content-tertiary group-hover:text-primary group-hover:translate-x-0.5 transition" />
                </motion.button>
              </RevealItem>
            ))}
          </Reveal>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card title="Đơn đặt theo trạng thái" subtitle={byStatus ? `${statusTotal.toLocaleString('vi-VN')} đơn từ trước đến nay` : 'Không tải được'} className="lg:col-span-2">
          {!byStatus ? (
            loading ? <SkeletonRows rows={3} /> : <Empty title="Không có dữ liệu" />
          ) : statusTotal === 0 ? (
            <Empty icon={<CalendarDays className="w-6 h-6" />} title="Chưa có đơn đặt nào" />
          ) : (
            <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center gap-6">
              <div className="w-40 h-40 relative shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} dataKey="value" nameKey="label" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none" animationDuration={900}>
                      {chartData.map((item) => (
                        <Cell key={item.key} fill={item.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => Number(value).toLocaleString('vi-VN')} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-bold tabular-nums"><AnimatedNumber value={statusTotal} /></span>
                  <span className="text-[10px] text-content-secondary">đơn</span>
                </div>
              </div>
              <ul className="w-full space-y-3">
                {STATUSES.map((status, index) => {
                  const value = byStatus[status.key] ?? 0;
                  return (
                    <li key={status.key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="inline-flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: status.color }} />{status.label}</span>
                        <b className="tabular-nums">{value.toLocaleString('vi-VN')}</b>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: status.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${statusTotal ? (value / statusTotal) * 100 : 0}%` }}
                          transition={{ duration: 0.8, delay: 0.1 * index, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Card>

        <Card
          title="Lịch đặt gần đây"
          subtitle="8 đơn mới nhất theo giờ hẹn"
          className="lg:col-span-3"
          bodyClassName="p-0"
          actions={<Button size="sm" variant="ghost" onClick={() => onTriggerAction('view-bookings')}>Xem tất cả <ChevronRight className="w-3.5 h-3.5" /></Button>}
        >
          {!recent ? (
            <div className="p-5">{loading ? <SkeletonRows rows={5} /> : <Empty title="Không tải được lịch đặt" />}</div>
          ) : !recent.length ? (
            <Empty icon={<CalendarDays className="w-6 h-6" />} title="Chưa có lịch đặt" />
          ) : (
            <ul className="divide-y divide-surface-borderSubtle">
              {recent.map((booking, index) => {
                const status = STATUS_LABEL[booking.status] ?? { label: booking.status, tone: 'gray' as const };
                const name = booking.customer?.displayName || 'Khách hàng';
                return (
                  <motion.li
                    key={booking.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="px-5 py-3 flex items-center gap-3 hover:bg-surface-subtle transition-colors"
                  >
                    <span className="w-9 h-9 rounded-full bg-primary-soft text-primary text-xs font-bold flex items-center justify-center shrink-0">
                      {name.split(/\s+/).slice(-2).map((word) => word[0]).join('').toUpperCase()}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold truncate">{name}</span>
                      <span className="block text-[11px] text-content-secondary truncate">
                        {booking.items?.map((item) => item.serviceName).filter(Boolean).join(' + ') || 'Dịch vụ'} · KTV {booking.technician?.user?.displayName || 'chưa phân công'}
                      </span>
                    </span>
                    <span className="hidden sm:block text-right shrink-0">
                      <span className="block text-xs font-semibold tabular-nums">{money(Number(booking.totalAmount ?? 0))}</span>
                      <span className="block text-[11px] text-content-tertiary">
                        {booking.scheduledStart ? new Date(booking.scheduledStart).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                    </span>
                    <Badge tone={status.tone} dot>{status.label}</Badge>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
