import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileWarning,
  Grid2X2,
  ImageIcon,
  Mail,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Wallet,
  XCircle,
} from 'lucide-react';
import { request } from '../api/client';
import { PageHeader } from '../components/common/PageHeader';
import { useToast } from '../components/ui/ToastContainer';
import { AnimatedNumber, Badge, Button, Input, Select } from '../components/ui/kit';
import { ComplaintChatDrawer } from '../components/ComplaintChatDrawer';

type Status = 'SUBMITTED' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';
type Complaint = {
  id: string;
  bookingId: string;
  reasonCode: string;
  detail: string;
  contactEmail: string;
  status: Status;
  createdAt: string;
  customer?: { displayName?: string | null; avatarUrl?: string | null } | null;
  booking?: {
    status: string;
    totalAmount: number | string;
    scheduledStart: string;
    technician?: { user?: { displayName?: string | null } | null } | null;
  } | null;
  conversation?: { id: string; lastMessageAt?: string | null } | null;
  evidence?: unknown[];
};

const REASONS: Record<string, string> = {
  SERVICE_ISSUE: 'Vấn đề dịch vụ',
  TECHNICIAN_NO_CONTACT: 'KTV không liên hệ, không đến',
  TECHNICIAN_BEHAVIOR: 'Thái độ KTV',
  SAFETY_ISSUE: 'An toàn',
  PAYMENT_ISSUE: 'Thanh toán',
  OTHER: 'Khác',
};

const STATUS: Record<Status, { label: string; tone: 'blue' | 'amber' | 'green' | 'red'; stripe: string; icon: typeof Clock3 }> = {
  SUBMITTED: { label: 'Mới gửi', tone: 'blue', stripe: 'bg-[#2970C2]', icon: FileWarning },
  IN_REVIEW: { label: 'Đang xử lý', tone: 'amber', stripe: 'bg-[#D99A1E]', icon: Clock3 },
  RESOLVED: { label: 'Đã giải quyết', tone: 'green', stripe: 'bg-[#2E7D4A]', icon: CheckCircle2 },
  REJECTED: { label: 'Từ chối', tone: 'red', stripe: 'bg-[#D9534F]', icon: XCircle },
};

const BOOKING_STATUS: Record<string, { label: string; tone: 'blue' | 'amber' | 'green' | 'red' | 'gray' }> = {
  OPEN: { label: 'Đang tìm KTV', tone: 'blue' },
  PENDING: { label: 'Chờ KTV nhận', tone: 'amber' },
  CONFIRMED: { label: 'Đang diễn ra', tone: 'amber' },
  COMPLETED: { label: 'Đã hoàn thành', tone: 'green' },
  CANCELLED: { label: 'Đã hủy', tone: 'red' },
  EXPIRED: { label: 'Hết hạn', tone: 'gray' },
};

/** Next steps an admin can take from each status. */
const ACTIONS: Record<Status, Array<{ to: Status; label: string; variant: 'primary' | 'secondary' | 'danger'; icon: React.ReactNode }>> = {
  SUBMITTED: [
    { to: 'IN_REVIEW', label: 'Tiếp nhận xử lý', variant: 'primary', icon: <Clock3 className="w-4 h-4" /> },
    { to: 'REJECTED', label: 'Từ chối', variant: 'danger', icon: <XCircle className="w-4 h-4" /> },
  ],
  IN_REVIEW: [
    { to: 'RESOLVED', label: 'Đã giải quyết', variant: 'primary', icon: <CheckCircle2 className="w-4 h-4" /> },
    { to: 'REJECTED', label: 'Từ chối', variant: 'danger', icon: <XCircle className="w-4 h-4" /> },
  ],
  RESOLVED: [{ to: 'IN_REVIEW', label: 'Mở lại', variant: 'secondary', icon: <RotateCcw className="w-4 h-4" /> }],
  REJECTED: [{ to: 'IN_REVIEW', label: 'Mở lại', variant: 'secondary', icon: <RotateCcw className="w-4 h-4" /> }],
};

const FILTERS: Array<{ value: '' | Status; label: string; icon: typeof Grid2X2; color: string }> = [
  { value: '', label: 'Tất cả', icon: Grid2X2, color: 'text-primary bg-primary-soft' },
  { value: 'SUBMITTED', label: 'Mới gửi', icon: FileWarning, color: 'text-[#2970C2] bg-[#EDF4FC]' },
  { value: 'IN_REVIEW', label: 'Đang xử lý', icon: Clock3, color: 'text-[#B87A14] bg-[#FEF6E9]' },
  { value: 'RESOLVED', label: 'Đã giải quyết', icon: CheckCircle2, color: 'text-[#21784A] bg-[#EAF5EC]' },
  { value: 'REJECTED', label: 'Từ chối', icon: XCircle, color: 'text-[#B9403A] bg-[#FDEDEC]' },
];

const money = (value: number | string) => `${new Intl.NumberFormat('vi-VN').format(Number(value))}đ`;
const dateTime = (value: string) =>
  new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

export function ComplaintsPage() {
  const { addToast } = useToast();
  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'' | Status>('');
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);

  // Always load every complaint so the counters stay right whichever filter is active.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await request<Complaint[]>('/admin/complaints'));
    } catch (error) {
      addToast({ type: 'error', title: 'Không tải được khiếu nại', message: error instanceof Error ? error.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [addToast]);
  useEffect(() => void load(), [load]);

  const update = async (complaint: Complaint, next: Status) => {
    setSavingId(complaint.id);
    try {
      await request(`/admin/complaints/${complaint.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) });
      setItems((current) => current.map((item) => (item.id === complaint.id ? { ...item, status: next } : item)));
      addToast({ type: 'success', title: `Đã chuyển sang "${STATUS[next].label}"`, message: `Booking ${complaint.bookingId.slice(0, 8)}` });
    } catch (error) {
      addToast({ type: 'error', title: 'Không cập nhật được', message: error instanceof Error ? error.message : undefined });
    } finally {
      setSavingId(null);
    }
  };

  const count = (value: '' | Status) => (value ? items.filter((item) => item.status === value).length : items.length);
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        (!status || item.status === status) &&
        (!reason || item.reasonCode === reason) &&
        (!term ||
          `${item.bookingId} ${item.detail} ${item.contactEmail} ${item.customer?.displayName ?? ''}`.toLowerCase().includes(term)),
    );
  }, [items, status, reason, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Khiếu nại booking"
        subtitle="Tiếp nhận và xử lý phản ánh của khách hàng về các booking"
        icon={<ShieldAlert className="w-5 h-5" />}
        actions={
          <Button onClick={() => void load()} loading={loading} icon={<RefreshCw className="w-4 h-4" />}>
            Làm mới
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {FILTERS.map(({ value, label, icon: Icon, color }) => {
          const active = status === value;
          return (
            <motion.button
              key={label}
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setStatus(value)}
              aria-pressed={active}
              className={`relative rounded-2xl border bg-white p-4 text-left transition-shadow ${
                active ? 'border-primary shadow-[0_0_0_3px_rgba(46,125,74,0.12)]' : 'border-surface-border hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                  <Icon className="w-[18px] h-[18px]" />
                </span>
                <span className="text-2xl font-bold text-content-primary tabular-nums">
                  <AnimatedNumber value={count(value)} />
                </span>
              </div>
              <div className="mt-3 text-sm font-semibold text-content-primary">{label}</div>
            </motion.button>
          );
        })}
      </div>

      <section className="rounded-2xl border border-surface-border bg-white">
        <div className="flex flex-col md:flex-row gap-3 p-4 border-b border-surface-borderSubtle">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-content-tertiary absolute left-3.5 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo mã booking, tên khách, email, nội dung…"
              className="pl-10"
            />
          </div>
          <div className="md:w-64">
            <Select value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Lọc theo lý do">
              <option value="">Tất cả lý do</option>
              {Object.entries(REASONS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {loading && !items.length ? (
          <div className="p-5 space-y-3">
            {[0, 1, 2].map((key) => (
              <div key={key} className="h-32 rounded-xl bg-surface-subtle animate-pulse" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 px-6">
            <div className="w-20 h-20 rounded-full bg-primary-soft flex items-center justify-center">
              <ShieldAlert className="w-10 h-10 text-primary" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-content-primary">
              {items.length ? 'Không có khiếu nại phù hợp' : 'Chưa có khiếu nại nào'}
            </h2>
            <p className="mt-1 max-w-sm text-sm text-content-secondary">
              {items.length
                ? 'Thử đổi trạng thái, lý do hoặc từ khóa tìm kiếm.'
                : 'Khi khách hàng gửi khiếu nại từ ứng dụng, chúng sẽ hiện tại đây.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-surface-borderSubtle">
            <AnimatePresence initial={false}>
              {visible.map((complaint, index) => {
                const state = STATUS[complaint.status];
                const booking = complaint.booking ? BOOKING_STATUS[complaint.booking.status] : undefined;
                const name = complaint.customer?.displayName || 'Khách hàng';
                return (
                  <motion.li
                    key={complaint.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index, 8) * 0.03 } }}
                    exit={{ opacity: 0 }}
                    className="relative p-5 pl-6"
                  >
                    <span className={`absolute left-0 top-5 bottom-5 w-1 rounded-r-full ${state.stripe}`} />
                    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                      <div className="flex-1 min-w-0 space-y-3">
                        <div className="flex items-start gap-3">
                          {complaint.customer?.avatarUrl ? (
                            <img src={complaint.customer.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <span className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3C9A5E] to-primary text-white text-sm font-bold flex items-center justify-center">
                              {name.trim().charAt(0).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-content-primary">{name}</span>
                              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded-md bg-surface-subtle border border-surface-border text-content-secondary">
                                #{complaint.bookingId.slice(0, 8)}
                              </span>
                              <Badge tone={state.tone} dot>
                                {state.label}
                              </Badge>
                            </div>
                            <div className="mt-0.5 text-xs text-content-secondary">
                              <span className="font-semibold text-[#B9403A]">{REASONS[complaint.reasonCode] ?? complaint.reasonCode}</span>
                              {' · '}gửi lúc {dateTime(complaint.createdAt)}
                            </div>
                          </div>
                        </div>

                        <p className="text-sm text-content-primary leading-relaxed rounded-xl bg-surface-subtle px-4 py-3 whitespace-pre-line">
                          {complaint.detail}
                        </p>

                        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-content-secondary">
                          {complaint.booking && (
                            <>
                              <span className="inline-flex items-center gap-1.5">
                                <CalendarClock className="w-3.5 h-3.5" /> Lịch hẹn {dateTime(complaint.booking.scheduledStart)}
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <Wallet className="w-3.5 h-3.5" /> {money(complaint.booking.totalAmount)}
                              </span>
                              {complaint.booking.technician?.user?.displayName && (
                                <span>KTV: <b className="text-content-primary">{complaint.booking.technician.user.displayName}</b></span>
                              )}
                              {booking && <Badge tone={booking.tone}>Đơn: {booking.label}</Badge>}
                            </>
                          )}
                          <a href={`mailto:${complaint.contactEmail}`} className="inline-flex items-center gap-1.5 hover:text-primary">
                            <Mail className="w-3.5 h-3.5" /> {complaint.contactEmail}
                          </a>
                          <span className="inline-flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5" /> {complaint.evidence?.length ?? 0} ảnh minh chứng
                          </span>
                        </div>
                      </div>

                      <div className="flex lg:flex-col gap-2 lg:w-44 shrink-0">
                        <Button
                          size="sm"
                          variant="soft"
                          icon={<MessageCircle className="w-4 h-4" />}
                          onClick={() => setChatId(complaint.id)}
                          className="flex-1 lg:flex-none"
                        >
                          Chat với khách
                        </Button>
                        {ACTIONS[complaint.status].map((action) => (
                          <Button
                            key={action.to}
                            size="sm"
                            variant={action.variant}
                            icon={action.icon}
                            loading={savingId === complaint.id}
                            onClick={() => void update(complaint, action.to)}
                            className="flex-1 lg:flex-none"
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </section>

      <ComplaintChatDrawer complaintId={chatId} onClose={() => setChatId(null)} />
    </div>
  );
}

export default ComplaintsPage;
