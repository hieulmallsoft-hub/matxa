import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays,
  Plus,
  Download,
  Filter,
  UsersRound,
  Sparkles,
  CheckCircle2,
  Clock,
  User,
  Phone,
  MapPin,
  CreditCard,
  FileText,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { RecentOrdersTable } from '../components/dashboard/RecentOrdersTable';
import { OrderItem, OrderStatus } from '../types/dashboard';
import { useToast } from '../components/ui/ToastContainer';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { DetailDrawer } from '../components/common/DetailDrawer';
import { StatusBadge } from '../components/common/StatusBadge';
import { request } from '../api/client';
import { Button, Field, Textarea } from '../components/ui/kit';

interface ApiBooking {
  id: string;
  status: string;
  assignmentMode?: string;
  applicationStatus?: string | null;
  isSelected?: boolean;
  isApplicant?: boolean;
  mode?: string;
  scheduledStart: string;
  scheduledEnd?: string;
  totalAmount: number;
  subtotal?: number;
  customer?: { id?: string; displayName?: string | null; avatarUrl?: string | null; phoneNumber?: string | null };
  technician?: { id?: string; user?: { id?: string; displayName?: string | null; avatarUrl?: string | null; phoneNumber?: string | null } };
  applications?: Array<{
    applicationId?: string;
    technicianId?: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    status?: string;
    isSelected?: boolean;
    isApplicant?: boolean;
    appliedAt?: string;
  }>;
  items?: Array<{ id?: string; serviceName?: string; durationMinutes?: number; unitPrice?: number }>;
  payment?: { method?: string; status?: string };
  addressSnapshot?: { address?: string; city?: string; district?: string };
  note?: string;
}

export const OrdersPage: React.FC = () => {
  const { addToast } = useToast();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [rawBookings, setRawBookings] = useState<ApiBooking[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadBookings = () => {
    setIsLoading(true);
    void request<{ items?: ApiBooking[]; total?: number }>('/admin/marketplace/bookings?limit=100')
      .then((res) => {
        const items = res.items ?? [];
        setRawBookings(items);
        const mapped: OrderItem[] = items.map((b) => {
          const customerName = b.customer?.displayName || 'Khách hàng';
          const serviceName = b.items?.[0]?.serviceName || 'Dịch vụ Spa';
          let normalizedStatus: OrderStatus = 'Pending';
          const st = (b.status || '').toUpperCase();
          if (st === 'COMPLETED') normalizedStatus = 'Completed';
          else if (st === 'CONFIRMED' || st === 'PROCESSING' || st === 'IN_PROGRESS') normalizedStatus = 'Processing';
          else if (st === 'CANCELLED' || st === 'EXPIRED') normalizedStatus = 'Cancelled';
          else normalizedStatus = 'Pending';

          const dateFormatted = b.scheduledStart
            ? new Date(b.scheduledStart).toLocaleString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Chưa có';

          return {
            id: b.id.slice(0, 8),
            customer: {
              name: customerName,
              email: b.customer?.phoneNumber || '',
              avatar: b.customer?.avatarUrl || '',
              initials: customerName.slice(0, 2).toUpperCase(),
            },
            product: {
              name: serviceName,
              sku: b.id.slice(0, 8),
              category: b.mode === 'HOME' ? 'Tại nhà' : 'Tại cơ sở',
            },
            date: dateFormatted,
            amount: b.totalAmount ?? 0,
            payment: {
              method: 'Credit Card',
              cardLast4: b.payment?.method === 'CASH' ? 'Tiền mặt' : (b.payment?.method || 'VietQR'),
            },
            status: normalizedStatus,
          };
        });
        setOrders(mapped);
      })
      .catch((error) => {
        addToast({
          title: 'Không tải được lịch đặt',
          message: error instanceof Error ? error.message : 'Vui lòng thử lại',
          type: 'error',
        });
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const selectedRaw = selectedOrder
    ? rawBookings.find((b) => b.id.startsWith(selectedOrder.id))
    : null;

  const handleExportCSV = () => {
    if (!rawBookings.length) {
      addToast({ title: 'Chưa có dữ liệu để xuất', type: 'warning' });
      return;
    }
    const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['Mã đơn', 'Trạng thái', 'Khách hàng', 'SĐT khách', 'KTV', 'Dịch vụ', 'Bắt đầu', 'Tổng tiền (VND)', 'Thanh toán', 'Địa chỉ'];
    const rows = rawBookings.map((booking) => [
      booking.id,
      booking.status,
      booking.customer?.displayName,
      booking.customer?.phoneNumber,
      booking.technician?.user?.displayName,
      (booking.items ?? []).map((item) => item.serviceName).join(' + '),
      booking.scheduledStart ? new Date(booking.scheduledStart).toLocaleString('vi-VN') : '',
      Number(booking.totalAmount ?? 0),
      [booking.payment?.method, booking.payment?.status].filter(Boolean).join(' / '),
      [booking.addressSnapshot?.address, booking.addressSnapshot?.district, booking.addressSnapshot?.city].filter(Boolean).join(', '),
    ]);
    // BOM so Excel opens the UTF-8 Vietnamese text correctly.
    const csv = '\uFEFF' + [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `lich-dat-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    addToast({ title: 'Đã xuất file CSV', message: `${rawBookings.length} lịch đặt`, type: 'success' });
  };

  const [cancelReason, setCancelReason] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const cancelBooking = async () => {
    if (!selectedRaw || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      await request(`/bookings/${selectedRaw.id}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({ reasonCode: 'OTHER', reasonText: cancelReason.trim() }),
      });
      addToast({ title: 'Đã hủy lịch đặt', message: `Đơn ${selectedRaw.id.slice(0, 8)} đã được hủy và khách sẽ nhận thông báo.`, type: 'success' });
      setCancelOpen(false);
      setCancelReason('');
      setSelectedOrder(null);
      loadBookings();
    } catch (error) {
      addToast({ title: 'Không hủy được lịch đặt', message: error instanceof Error ? error.message : 'Vui lòng thử lại', type: 'error' });
    } finally {
      setCancelling(false);
    }
  };


  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6 pb-12"
    >
      {/* 1. Page Header */}
      <PageHeader
        title="Lịch đặt & Đơn hàng"
        subtitle="Quản lý và điều phối tất cả các ca trị liệu massage & spa tại nhà"
        badge={`${orders.filter((o) => o.status === 'Processing').length} ca đang phục vụ`}
        badgeTone="blue"
        breadcrumbs={[
          { label: 'Psyocore' },
          { label: 'Lịch đặt & Đơn hàng' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={loadBookings}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E5EBE5] text-xs font-semibold text-[#66756B] hover:text-[#1C2B20] hover:bg-[#F6F8F4] transition-all cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Tải lại</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E5EBE5] text-xs font-semibold text-[#66756B] hover:text-[#1C2B20] hover:bg-[#F6F8F4] transition-all cursor-pointer shadow-2xs"
            >
              <Download className="w-4 h-4" />
              <span>Xuất CSV</span>
            </button>

          </div>
        }
      />

      {/* 2. Order Summary Metrics (hidden fake metrics similar to CustomersPage) */}
      {false && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            label="Tổng số lịch đặt tháng này"
            value="0 lịch"
            change={12.4}
            isPositive={true}
            caption="so với tháng 9"
            icon={<CalendarDays className="w-5 h-5" />}
            tone="primary"
            sparkline={[98, 105, 112, 118, 122, 130, 134, 142]}
          />
          <StatCard
            label="Giá trị đơn trung bình"
            value="0 đ"
            change={6.2}
            isPositive={true}
            caption="tăng 40.000 đ/đơn"
            icon={<Sparkles className="w-5 h-5" />}
            tone="success"
            sparkline={[640, 650, 655, 660, 670, 675, 680]}
          />
          <StatCard
            label="Tỷ lệ hoàn thành đúng giờ"
            value="0%"
            change={1.2}
            isPositive={true}
            caption="trung bình đến trước 10p"
            icon={<CheckCircle2 className="w-5 h-5" />}
            tone="info"
            sparkline={[96.5, 97.0, 97.5, 98.0, 98.4, 98.6]}
          />
          <StatCard
            label="Tỷ lệ hủy đơn"
            value="0%"
            change={-0.6}
            isPositive={true}
            caption="thấp hơn tiêu chuẩn ngành (5%)"
            icon={<Clock className="w-5 h-5" />}
            tone="warning"
            sparkline={[2.4, 2.1, 1.9, 1.8, 1.6, 1.5, 1.4]}
          />
        </div>
      )}

      {/* 3. Main Interactive Orders Table */}
      <RecentOrdersTable onSelectOrder={setSelectedOrder} orders={orders} />

      {/* 4. Booking Detail Right Drawer */}
      <DetailDrawer
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `Chi tiết lịch đặt ${selectedOrder.id}` : ''}
        subtitle="Thông tin khách hàng, gói trị liệu và tiến trình thực hiện"
        badge={selectedOrder ? <StatusBadge status={selectedOrder.status} size="sm" /> : undefined}
        footer={
          selectedRaw && ['OPEN', 'PENDING', 'CONFIRMED'].includes(selectedRaw.status) ? (
            <Button variant="danger" onClick={() => setCancelOpen(true)}>
              Hủy lịch đặt
            </Button>
          ) : (
            <span className="text-xs text-[#66756B]">Đơn đã kết thúc, không còn thao tác.</span>
          )
        }
      >
        {selectedOrder && (
          <div className="space-y-6">
            {/* Customer Info Card */}
            <div className="p-4 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] space-y-3">
              <span className="text-xs font-bold text-[#66756B] uppercase tracking-wider block">
                Thông tin khách hàng
              </span>
              <div className="flex items-center gap-3">
                {selectedOrder.customer.avatar ? (
                  <img
                    src={selectedOrder.customer.avatar}
                    alt={selectedOrder.customer.name}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-[#EAF5EC]"
                  />
                ) : (
                  <span className="w-12 h-12 rounded-full bg-[#EAF5EC] text-[#2E7D4A] font-bold text-base flex items-center justify-center ring-2 ring-[#EAF5EC]">
                    {selectedOrder.customer.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div>
                  <h4 className="font-bold text-sm text-[#1C2B20]">
                    {selectedOrder.customer.name}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-[#66756B] mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-[#2E7D4A]" />
                    <span>{selectedRaw?.customer?.phoneNumber || selectedOrder.customer.email || 'Chưa cập nhật'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-[#E5EBE5] flex items-start gap-2 text-xs text-[#66756B]">
                <MapPin className="w-3.5 h-3.5 text-[#2E7D4A] mt-0.5 flex-shrink-0" />
                <span>{selectedRaw?.addressSnapshot?.address || (selectedRaw?.addressSnapshot as any)?.street || 'Chưa có thông tin địa chỉ cụ thể'}</span>
              </div>
            </div>

            {/* Service & Technician Card */}
            <div className="p-4 rounded-xl bg-white border border-[#E5EBE5] space-y-3 shadow-2xs">
              <span className="text-xs font-bold text-[#66756B] uppercase tracking-wider block">
                Dịch vụ & Kỹ thuật viên
              </span>
              <div className="flex justify-between items-start">
                <div>
                  <h5 className="font-bold text-sm text-[#1C2B20]">{selectedOrder.product.name}</h5>
                  <span className="text-xs text-[#66756B]">
                    {selectedOrder.product.category}
                  </span>
                </div>
                <span className="font-bold text-sm text-[#2E7D4A]">
                  {new Intl.NumberFormat('vi-VN').format(selectedOrder.amount)} đ
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#EAF5EC]/60 border border-[#D0E7D5] flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#2E7D4A]" />
                  <span>
                    Kỹ thuật viên phụ trách:{' '}
                    <strong>{selectedRaw?.technician?.user?.displayName || 'Chưa phân công'}</strong>
                  </span>
                </div>
                <span className="text-[#2E7D4A] font-semibold">
                  {selectedRaw?.technician ? 'Đã nhận ca' : 'Chờ gán'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-[#E5EBE5] space-y-3 shadow-2xs">
              <span className="text-xs font-bold text-[#66756B] uppercase tracking-wider block">
                KTV được chọn / ứng tuyển
              </span>
              {selectedRaw?.technician && (
                <div className="p-3 rounded-lg bg-[#EAF5EC] border border-[#B9DEC2] text-xs">
                  <div className="font-bold text-[#1C2B20]">KTV đã được chọn</div>
                  <div className="text-[#2E7D4A] mt-1">{selectedRaw.technician.user?.displayName || 'Chưa cập nhật tên'}</div>
                </div>
              )}
              {selectedRaw?.applications?.length ? (
                <div className="space-y-2">
                  {selectedRaw.applications.map((application, index) => {
                    const labels: Record<string, string> = {
                      SELECTED: 'Đã được chọn',
                      APPLIED: 'Đã ứng tuyển – chờ khách chọn',
                      NOT_SELECTED: 'Không được chọn',
                      WITHDRAWN: 'Đã rút ứng tuyển',
                      DECLINED: 'Đã từ chối',
                      EXPIRED: 'Đã hết hạn',
                    };
                    const isSelected = application.isSelected || application.status === 'SELECTED';
                    const label = labels[application.status || ''] || application.status || 'Không rõ trạng thái';
                    return (
                      <div key={application.applicationId || application.technicianId || index} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[#F6F8F4] border border-[#E5EBE5] text-xs">
                        <div className="min-w-0">
                          <div className="font-semibold text-[#1C2B20] truncate">{application.displayName || 'KTV chưa cập nhật tên'}</div>
                          <div className="text-[#66756B] mt-1">{isSelected ? 'KTV đã được chọn' : label}</div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 font-semibold ${isSelected ? 'bg-[#DFF3E4] text-[#217A3D]' : application.status === 'APPLIED' ? 'bg-[#FFF3D6] text-[#9A6700]' : 'bg-[#EEF1EE] text-[#66756B]'}`}>
                          {isSelected ? 'ĐÃ CHỌN' : label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : !selectedRaw?.technician ? (
                <div className="text-xs text-[#94A399]">Chưa có KTV được chọn hoặc ứng tuyển.</div>
              ) : null}
            </div>

            {/* Timeline Booking */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-[#66756B] uppercase tracking-wider block">
                Tiến trình thực hiện lịch đặt
              </span>
              <div className="space-y-3 relative pl-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E5EBE5]">
                {[
                  { time: selectedOrder.date, title: 'Khách hàng đặt lịch thành công', done: true },
                  { time: '--:--', title: selectedRaw?.technician ? `Gán KTV ${selectedRaw.technician.user?.displayName}` : 'Chờ xác nhận / gán KTV', done: !!selectedRaw?.technician },
                  { time: '--:--', title: 'Kỹ thuật viên thực hiện liệu trình', done: selectedOrder.status === 'Completed' || selectedOrder.status === 'Processing' },
                  { time: '--:--', title: 'Hoàn thành dịch vụ & thanh toán', done: selectedOrder.status === 'Completed' },
                ].map((step, idx) => (
                  <div key={idx} className="relative text-xs">
                    <span
                      className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full ring-2 ring-white ${
                        step.done ? 'bg-[#2E7D4A]' : 'bg-[#D0DCD1]'
                      }`}
                    />
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold ${step.done ? 'text-[#1C2B20]' : 'text-[#94A399]'}`}>
                        {step.title}
                      </span>
                      <span className="text-[#94A399] font-mono">{step.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment & Notes */}
            <div className="p-4 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] space-y-2 text-xs">
              <div className="flex justify-between text-[#66756B]">
                <span>Phương thức thanh toán:</span>
                <span className="font-semibold text-[#1C2B20]">{selectedOrder.payment.cardLast4 || 'Chuyển khoản VietQR'}</span>
              </div>
              <div className="flex justify-between text-[#66756B]">
                <span>Trạng thái thanh toán:</span>
                <span className="font-semibold text-[#2E9B62]">
                  {selectedRaw?.payment?.status === 'PAID' ? 'Đã thanh toán đủ' : (selectedRaw?.payment?.status === 'UNPAID' ? 'Chưa thanh toán (Thu tiền mặt)' : 'Chờ xử lý')}
                </span>
              </div>
              <div className="pt-2 border-t border-[#E5EBE5] text-[#66756B]">
                <strong>Ghi chú:</strong> {selectedRaw?.note || 'Không có ghi chú thêm.'}
              </div>
            </div>
          </div>
        )}
      </DetailDrawer>

      <AnimatePresence>
        {cancelOpen && selectedRaw && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !cancelling && setCancelOpen(false)} className="fixed inset-0 bg-[#1C2B20]/40 backdrop-blur-sm" />
            <motion.form
              role="dialog"
              aria-modal="true"
              aria-label="Hủy lịch đặt"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              onSubmit={(event) => {
                event.preventDefault();
                void cancelBooking();
              }}
              className="relative w-full max-w-md bg-white rounded-2xl border border-[#E5EBE5] shadow-modal p-6 space-y-4"
            >
              <div>
                <h2 className="text-lg font-bold">Hủy lịch đặt {selectedRaw.id.slice(0, 8)}?</h2>
                <p className="text-xs text-[#66756B] mt-1">Khách và KTV (nếu có) sẽ nhận thông báo kèm lý do. Không thể hoàn tác.</p>
              </div>
              <Field label="Lý do hủy" required>
                <Textarea autoFocus required rows={3} maxLength={500} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="VD: Khách yêu cầu hủy qua hotline." />
              </Field>
              <div className="flex justify-end gap-2">
                <Button onClick={() => setCancelOpen(false)} disabled={cancelling}>Giữ lại</Button>
                <Button type="submit" variant="danger" loading={cancelling} disabled={!cancelReason.trim()}>Hủy lịch đặt</Button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default OrdersPage;
