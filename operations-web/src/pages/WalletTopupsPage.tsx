import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Wallet } from 'lucide-react';
import { request } from '../api/client';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { useToast } from '../components/ui/ToastContainer';
import { Badge, Button, Select } from '../components/ui/kit';

type TopupStatus = 'PENDING_PAYMENT' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
type Topup = {
  id: string;
  amountVnd: number;
  status: TopupStatus;
  paymentMethod: string;
  referenceCode: string;
  failureMessage: string | null;
  createdAt: string;
  processedAt: string | null;
  technician: { userId: string; displayName: string | null; phoneNumber: string | null };
  walletBalanceVnd: number;
};
type TopupList = {
  items: Topup[];
  total: number;
  page: number;
  limit: number;
  summary: { successAmountThisMonth: number; successCountThisMonth: number };
};

const STATUS: Record<TopupStatus, { label: string; tone: 'green' | 'amber' | 'red' | 'gray' | 'blue' }> = {
  SUCCESS: { label: 'Thành công', tone: 'green' },
  PENDING_PAYMENT: { label: 'Chờ thanh toán', tone: 'amber' },
  PROCESSING: { label: 'Đang xử lý', tone: 'blue' },
  FAILED: { label: 'Thất bại', tone: 'red' },
  EXPIRED: { label: 'Hết hạn, chưa nhận tiền', tone: 'gray' },
  CANCELLED: { label: 'Đã hủy', tone: 'gray' },
};
const LIMIT = 20;
const money = (value: number) => `${value.toLocaleString('vi-VN')}đ`;
const date = (value: string) =>
  new Date(value).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Every top-up a technician started, so the admin can answer "I paid, where is my money?". */
export function WalletTopupsPage() {
  const { addToast } = useToast();
  const [status, setStatus] = useState<'' | TopupStatus>('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TopupList | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), limit: String(LIMIT), ...(status ? { status } : {}) });
      setData(await request<TopupList>(`/admin/wallet/topups?${query}`));
    } catch (error) {
      addToast({ type: 'error', title: 'Không tải được lịch sử nạp tiền', message: error instanceof Error ? error.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [addToast, page, status]);
  useEffect(() => {
    void load();
  }, [load]);

  const pages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nạp tiền ví KTV"
        subtitle="Các lệnh KTV nạp tiền vào ví để nhận đơn. Đây là tiền của KTV, không phải doanh thu nền tảng."
        icon={<Wallet className="w-5 h-5" />}
        actions={<Button onClick={() => void load()} loading={loading} icon={<RefreshCw className="w-4 h-4" />}>Làm mới</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Nạp thành công tháng này"
          value={data ? money(data.summary.successAmountThisMonth) : '—'}
          caption={`${data?.summary.successCountThisMonth ?? 0} lệnh nạp`}
          icon={<Wallet className="w-5 h-5" />}
          tone="success"
        />
        <StatCard
          label="Tổng số lệnh"
          value={data?.total ?? 0}
          caption={status ? `trạng thái: ${STATUS[status].label}` : 'mọi trạng thái'}
          icon={<RefreshCw className="w-5 h-5" />}
          tone="info"
        />
      </div>

      <section className="rounded-2xl border border-surface-border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-surface-border">
          <span className="text-sm font-bold text-content-primary">Lịch sử nạp tiền</span>
          <div className="w-56">
            <Select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as '' | TopupStatus);
                setPage(1);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              {(Object.keys(STATUS) as TopupStatus[]).map((key) => (
                <option key={key} value={key}>{STATUS[key].label}</option>
              ))}
            </Select>
          </div>
        </div>

        {loading && !data ? (
          <div className="p-5 space-y-3">{[0, 1, 2].map((key) => <div key={key} className="h-12 rounded-xl bg-surface-subtle animate-pulse" />)}</div>
        ) : !data?.items.length ? (
          <p className="py-14 text-center text-sm text-content-secondary">Chưa có lệnh nạp tiền nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-content-tertiary">
                  <th className="px-4 py-2.5 font-semibold">Thời gian</th>
                  <th className="px-4 py-2.5 font-semibold">KTV</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Số tiền</th>
                  <th className="px-4 py-2.5 font-semibold">Trạng thái</th>
                  <th className="px-4 py-2.5 font-semibold">Mã giao dịch</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Số dư ví hiện tại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-borderSubtle">
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-content-secondary">{date(item.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-content-primary">{item.technician.displayName ?? '—'}</div>
                      <div className="text-xs text-content-tertiary">{item.technician.phoneNumber ?? ''}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-content-primary whitespace-nowrap">{money(item.amountVnd)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS[item.status]?.tone ?? 'gray'} dot>{STATUS[item.status]?.label ?? item.status}</Badge>
                      {item.failureMessage && <div className="mt-1 text-xs text-content-tertiary">{item.failureMessage}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-content-secondary">{item.referenceCode}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-content-secondary">{money(item.walletBalanceVnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-end gap-2 p-4 border-t border-surface-border text-sm">
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</Button>
            <span className="text-content-secondary">Trang {page}/{pages}</span>
            <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>Sau</Button>
          </div>
        )}
      </section>
    </div>
  );
}

export default WalletTopupsPage;
