import React, { useCallback, useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { request } from '../api/client';
import { PageHeader } from '../components/common/PageHeader';
import { useToast } from '../components/ui/ToastContainer';
import { useConfirm } from '../components/ui/useConfirm';
import { Badge, Button, Card, Empty, Tabs } from '../components/ui/kit';

type Pending = {
  technicianUserId: string;
  displayName: string | null;
  amount: number;
  bookingCount: number;
  upTo: string;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  transferNote: string;
  qrUrl: string | null;
};
type Payout = { id: string; displayName: string | null; amount: number; bookingCount: number; bankName: string | null; accountNumber: string | null; transferNote: string; paidAt: string };
type Refund = {
  id: string;
  bookingId: string;
  customerName: string | null;
  paidAmount: number;
  feeAmount: number;
  amount: number;
  reason: string;
  status: 'PENDING' | 'DONE';
  createdAt: string;
  doneAt: string | null;
  note: string | null;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  transferNote: string;
  qrUrl: string | null;
};
type Tab = 'payouts' | 'history' | 'refunds' | 'refunded';

const vnd = (value: number) => `${value.toLocaleString('vi-VN')}đ`;
const time = (iso: string) => new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
const errorText = (error: unknown) => (error instanceof Error ? error.message : 'Không kết nối được máy chủ');

/** CSV the bank's bulk-transfer screen can import (opens in Excel; UTF-8 BOM keeps Vietnamese names). */
function downloadCsv(rows: Pending[]) {
  const escape = (value: string | number | null) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = [
    ['Tên KTV', 'Ngân hàng', 'Số tài khoản', 'Chủ tài khoản', 'Số tiền', 'Nội dung', 'Số đơn'].map(escape).join(','),
    ...rows.map((row) => [row.displayName, row.bankName, row.accountNumber, row.accountName, row.amount, row.transferNote, row.bookingCount].map(escape).join(',')),
  ];
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `chi-tra-ktv-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Paying technicians their online-booking earnings and refunding cancelled paid bookings, both by bank transfer. */
export const PayoutsPage: React.FC = () => {
  const { addToast } = useToast();
  const { confirm, prompt, dialog } = useConfirm();
  const [tab, setTab] = useState<Tab>('payouts');
  const [pending, setPending] = useState<Pending[]>([]);
  const [history, setHistory] = useState<Payout[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'payouts') setPending(await request<Pending[]>('/admin/payouts/pending'));
      if (tab === 'history') setHistory(await request<Payout[]>('/admin/payouts'));
      if (tab === 'refunds' || tab === 'refunded') setRefunds(await request<Refund[]>(`/admin/refunds?status=${tab === 'refunds' ? 'PENDING' : 'DONE'}`));
    } catch (error) {
      addToast({ title: 'Không tải được dữ liệu', message: errorText(error), type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [tab, addToast]);
  useEffect(() => {
    void load();
  }, [load]);

  const markPaid = async (row: Pending) => {
    if (!(await confirm({ title: `Đã chuyển ${vnd(row.amount)} cho ${row.displayName ?? 'KTV'}?`, message: `Chỉ bấm khi đã chuyển khoản xong, nội dung "${row.transferNote}". KTV sẽ nhận thông báo.`, confirmText: 'Đã chi', tone: 'primary' }))) return;
    setBusy(row.technicianUserId);
    try {
      await request(`/admin/payouts/${row.technicianUserId}/paid`, { method: 'POST', body: JSON.stringify({ upTo: row.upTo, amount: row.amount }) });
      addToast({ title: 'Đã ghi nhận chi trả', message: `${row.displayName ?? 'KTV'} · ${vnd(row.amount)}`, type: 'success' });
      await load();
    } catch (error) {
      addToast({ title: 'Không ghi nhận được', message: errorText(error), type: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const markRefunded = async (row: Refund) => {
    const note = await prompt({ title: `Đã hoàn ${vnd(row.amount)} cho ${row.customerName ?? 'khách'}?`, message: 'Chỉ bấm khi đã chuyển khoản xong. Khách sẽ nhận thông báo.', placeholder: 'Ghi chú (không bắt buộc), ví dụ: đã chuyển VCB 16/11', confirmText: 'Đã hoàn', tone: 'primary' });
    if (note === null) return;
    setBusy(row.id);
    try {
      await request(`/admin/refunds/${row.id}/done`, { method: 'POST', body: JSON.stringify(note ? { note } : {}) });
      addToast({ title: 'Đã ghi nhận hoàn tiền', message: `${row.customerName ?? 'Khách'} · ${vnd(row.amount)}`, type: 'success' });
      await load();
    } catch (error) {
      addToast({ title: 'Không ghi nhận được', message: errorText(error), type: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const bankLine = (row: { bankName: string | null; accountNumber: string | null; accountName: string | null }) =>
    row.accountNumber ? `${row.bankName ?? ''} · ${row.accountNumber}${row.accountName ? ` · ${row.accountName}` : ''}` : null;

  return (
    <div className="space-y-6">
      {dialog}
      <PageHeader
        title="Chi trả & Hoàn tiền"
        subtitle="Tiền đơn trực tuyến khách trả online: chi phần của KTV và hoàn tiền đơn bị hủy"
        actions={
          <div className="flex gap-2">
            {tab === 'payouts' && pending.length > 0 && (
              <Button icon={<Download className="w-4 h-4" />} onClick={() => downloadCsv(pending)}>Xuất Excel</Button>
            )}
            <Button icon={<RefreshCw className="w-4 h-4" />} loading={loading} onClick={() => void load()}>Tải lại</Button>
          </div>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'payouts', label: 'Cần chi trả' },
          { value: 'history', label: 'Đã chi' },
          { value: 'refunds', label: 'Cần hoàn tiền' },
          { value: 'refunded', label: 'Đã hoàn' },
        ]}
      />

      {tab === 'payouts' && (
        <Card title="Cần chi trả cho KTV" subtitle="Thu nhập đơn trực tuyến đã hoàn thành (giá dịch vụ trừ hoa hồng), từ mức tối thiểu trong Cài đặt. Quét mã bằng app ngân hàng rồi bấm Đã chi.">
          {!pending.length ? (
            <Empty title={loading ? 'Đang tải…' : 'Chưa có KTV nào cần chi trả'} />
          ) : (
            <ul className="divide-y divide-surface-borderSubtle">
              {pending.map((row) => (
                <li key={row.technicianUserId} className="py-4 flex flex-wrap items-start gap-4">
                  {row.qrUrl ? (
                    <img src={row.qrUrl} alt="Mã VietQR" className="w-36 h-36 rounded-xl border border-surface-border bg-white object-contain" />
                  ) : (
                    <div className="w-36 h-36 rounded-xl border border-dashed border-surface-border flex items-center justify-center text-center text-[11px] text-content-tertiary p-2">KTV chưa nhập số tài khoản ngân hàng</div>
                  )}
                  <div className="flex-1 min-w-[220px] space-y-1 text-sm">
                    <p className="font-semibold">{row.displayName ?? row.technicianUserId}</p>
                    <p className="text-xl font-bold tabular-nums text-primary">{vnd(row.amount)}</p>
                    <p className="text-xs text-content-secondary">{row.bookingCount} đơn · đến {time(row.upTo)}</p>
                    <p className="text-xs">{bankLine(row) ?? <span className="text-status-danger">Chưa có tài khoản nhận tiền</span>}</p>
                    <p className="text-xs text-content-secondary">Nội dung: <span className="font-mono">{row.transferNote}</span></p>
                  </div>
                  <Button variant="primary" loading={busy === row.technicianUserId} disabled={!row.accountNumber} onClick={() => void markPaid(row)}>Đã chi</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'history' && (
        <Card title="Lịch sử chi trả">
          {!history.length ? (
            <Empty title={loading ? 'Đang tải…' : 'Chưa chi lần nào'} />
          ) : (
            <ul className="divide-y divide-surface-borderSubtle text-sm">
              {history.map((row) => (
                <li key={row.id} className="py-3 flex flex-wrap items-center gap-3">
                  <span className="flex-1 min-w-[200px]">
                    <span className="block font-semibold">{row.displayName ?? '—'}</span>
                    <span className="block text-xs text-content-secondary">{time(row.paidAt)} · {row.bookingCount} đơn · {row.bankName ?? ''} {row.accountNumber ?? ''}</span>
                  </span>
                  <span className="font-bold tabular-nums">{vnd(row.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {(tab === 'refunds' || tab === 'refunded') && (
        <Card
          title={tab === 'refunds' ? 'Cần hoàn tiền cho khách' : 'Đã hoàn tiền'}
          subtitle={tab === 'refunds' ? 'Đơn trực tuyến đã thanh toán rồi bị hủy. Tài khoản là tài khoản khách đã dùng để trả (nếu cổng thanh toán gửi về); không có thì liên hệ khách qua chat CSKH.' : undefined}
        >
          {!refunds.length ? (
            <Empty title={loading ? 'Đang tải…' : tab === 'refunds' ? 'Không có khoản nào cần hoàn' : 'Chưa hoàn khoản nào'} />
          ) : (
            <ul className="divide-y divide-surface-borderSubtle">
              {refunds.map((row) => (
                <li key={row.id} className="py-4 flex flex-wrap items-start gap-4">
                  {tab === 'refunds' && (row.qrUrl ? (
                    <img src={row.qrUrl} alt="Mã VietQR" className="w-36 h-36 rounded-xl border border-surface-border bg-white object-contain" />
                  ) : (
                    <div className="w-36 h-36 rounded-xl border border-dashed border-surface-border flex items-center justify-center text-center text-[11px] text-content-tertiary p-2">Không có tài khoản khách, cần hỏi khách</div>
                  ))}
                  <div className="flex-1 min-w-[220px] space-y-1 text-sm">
                    <p className="font-semibold">{row.customerName ?? row.bookingId} <span className="font-mono text-xs text-content-tertiary">#{row.bookingId.slice(0, 8).toUpperCase()}</span></p>
                    <p className="text-xl font-bold tabular-nums text-primary">{vnd(row.amount)}</p>
                    <p className="text-xs text-content-secondary">
                      Đã trả {vnd(row.paidAmount)}{row.feeAmount > 0 ? ` · giữ phí hủy ${vnd(row.feeAmount)}` : ''} · {row.reason}
                    </p>
                    {bankLine(row) && <p className="text-xs">{bankLine(row)}</p>}
                    <p className="text-xs text-content-secondary">
                      {tab === 'refunds' ? <>Nội dung: <span className="font-mono">{row.transferNote}</span></> : <>Hoàn lúc {row.doneAt ? time(row.doneAt) : '—'}{row.note ? ` · ${row.note}` : ''}</>}
                    </p>
                  </div>
                  {tab === 'refunds' ? (
                    <Button variant="primary" loading={busy === row.id} onClick={() => void markRefunded(row)}>Đã hoàn</Button>
                  ) : (
                    <Badge tone="green">Đã hoàn</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
};

export default PayoutsPage;
