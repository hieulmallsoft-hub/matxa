import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { request } from '../api/client';

export type CancelPeriod = 'today' | 'week' | 'month';
export type CancelStats = {
  today: number;
  week: number;
  month: number;
  lockedUntil: string | null;
  suspension?: { level: number; reason: string; source: string; endsAt: string } | null;
  /** Level and length the next suspension would have; needsReview = past the last level. */
  nextLevel?: number;
  nextHours?: number;
  needsReview?: boolean;
};

const hoursLabel = (hours?: number) => (!hours ? '' : hours % 24 === 0 ? `${hours / 24} ngày` : `${hours} giờ`);

export const CANCEL_PERIODS: Array<{ value: CancelPeriod; label: string }> = [
  { value: 'today', label: 'Hôm nay' },
  { value: 'week', label: '7 ngày' },
  { value: 'month', label: 'Tháng này' },
];

/** "Hôm nay / 7 ngày / Tháng này" switch shown in the table header. */
export function CancelPeriodSelect({ value, onChange }: { value: CancelPeriod; onChange: (value: CancelPeriod) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as CancelPeriod)}
      onClick={(e) => e.stopPropagation()}
      className="ml-1 px-1.5 py-0.5 rounded-md border border-[#E5EBE5] bg-white text-[10px] font-semibold normal-case text-[#1C2B20]"
      aria-label="Khoảng thời gian đếm số lần hủy"
    >
      {CANCEL_PERIODS.map((period) => (
        <option key={period.value} value={period.value}>{period.label}</option>
      ))}
    </select>
  );
}

const time = (iso: string) => new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

/** Number of taken bookings the person cancelled in the period; red from 3, with the cancel-limit lock. Click for the list. */
export function CancelCount({ stats, period, onOpen }: { stats?: CancelStats; period: CancelPeriod; onOpen: () => void }) {
  const count = stats?.[period] ?? 0;
  const tone = count >= 3 ? 'bg-[#FDF0EF] text-[#D04A44]' : count > 0 ? 'bg-[#FEF6E9] text-[#A86A0C]' : 'bg-[#F1F5EF] text-[#94A399]';
  return (
    <button type="button" onClick={onOpen} className="text-left" title="Xem các lần hủy">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${tone}`}>{count} đơn</span>
      {stats?.lockedUntil && (
        <span className="block mt-1 text-[10px] font-semibold text-[#D04A44]">
          Tạm khóa đến {time(stats.lockedUntil)}{stats.suspension ? ` (lần ${stats.suspension.level})` : ''}
        </span>
      )}
      {!stats?.lockedUntil && stats?.needsReview && <span className="block mt-1 text-[10px] font-semibold text-[#A86A0C]">Cần xem xét</span>}
    </button>
  );
}

type Cancellation = {
  id: string;
  mode: string;
  scheduledStart: string;
  cancelledAt: string;
  cancelledByRole: string | null;
  cancelPenalized: boolean;
  cancellationReasonCode: string | null;
  cancellationReasonText: string | null;
  totalAmount: number;
  services: string[];
  evidenceCount: number;
  customer: { displayName: string | null } | null;
  technician: { user: { displayName: string | null } } | null;
};

/** The person's cancellations in the last 30 days, so the admin can judge before blocking the account. */
export function CancellationsModal({
  user,
  onClose,
  onBlock,
  onSuspend,
  onLift,
}: {
  user: { id: string; name: string; blocked: boolean; stats?: CancelStats };
  onClose: () => void;
  onBlock: () => void;
  onSuspend: () => void;
  onLift: () => void;
}) {
  const stats = user.stats;
  const [items, setItems] = useState<Cancellation[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    request<Cancellation[]>(`/admin/marketplace/users/${user.id}/cancellations`)
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : 'Không tải được'));
  }, [user.id]);
  const counted = items?.filter((item) => item.cancelPenalized).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-[#1C2B20]/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-white rounded-2xl border border-[#E5EBE5] shadow-2xl z-10">
        <div className="px-5 py-4 border-b border-[#E5EBE5] flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#1C2B20]">Các lần hủy của {user.name}</h3>
            <p className="text-xs text-[#66756B] mt-0.5">
              30 ngày gần nhất{items ? ` · ${items.length} lần hủy, ${counted} lần bị tính phạt` : ''}
            </p>
            {stats?.suspension && (
              <p className="text-xs font-semibold text-[#D04A44] mt-1">
                Đang tạm khóa lần {stats.suspension.level} đến {time(stats.suspension.endsAt)} · {stats.suspension.reason}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#66756B] hover:bg-[#F6F8F4]" aria-label="Đóng"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {error ? (
            <p className="text-sm text-[#D04A44]">{error}</p>
          ) : !items ? (
            <p className="text-xs text-[#66756B]">Đang tải…</p>
          ) : !items.length ? (
            <p className="text-xs text-[#66756B]">Không hủy đơn nào trong 30 ngày.</p>
          ) : (
            <ul className="divide-y divide-[#F1F5EF]">
              {items.map((item) => (
                <li key={item.id} className="py-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[#66756B]">#{item.id.slice(0, 8)}</span>
                    <span className="font-semibold text-[#1C2B20]">{item.services.join(', ') || 'Dịch vụ'}</span>
                    {item.cancelPenalized ? (
                      <span className="px-1.5 py-0.5 rounded bg-[#FDF0EF] text-[#D04A44] font-semibold">Bị tính phạt</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-[#F1F5EF] text-[#66756B] font-semibold">Không tính</span>
                    )}
                    {item.evidenceCount > 0 && <span className="px-1.5 py-0.5 rounded bg-[#EEF4FF] text-[#3B82F6] font-semibold">{item.evidenceCount} ảnh bằng chứng</span>}
                  </div>
                  <div className="mt-1 text-[#66756B]">
                    Hủy lúc {time(item.cancelledAt)} · lịch {time(item.scheduledStart)} · {item.cancelledByRole === 'TECHNICIAN' ? `khách: ${item.customer?.displayName ?? '—'}` : `KTV: ${item.technician?.user.displayName ?? 'chưa có'}`}
                  </div>
                  {(item.cancellationReasonText || item.cancellationReasonCode) && (
                    <div className="mt-0.5 text-[#1C2B20]">Lý do: {item.cancellationReasonText || item.cancellationReasonCode}</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="px-5 py-3 border-t border-[#E5EBE5] bg-[#F6F8F4] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-[#E5EBE5] bg-white text-xs font-semibold text-[#66756B]">Đóng</button>
          {!user.blocked && (stats?.suspension ? (
            <button onClick={onLift} className="px-4 py-2 rounded-xl border border-[#C8EED7] bg-[#EAF5EC] text-[#2E7D4A] text-xs font-semibold">Mở sớm</button>
          ) : (
            <button onClick={onSuspend} className="px-4 py-2 rounded-xl bg-[#F2A93B] hover:bg-[#E0982A] text-white text-xs font-semibold">
              Tạm khóa{stats?.nextHours ? ` lần ${stats.nextLevel} · ${hoursLabel(stats.nextHours)}` : ''}
            </button>
          ))}
          {!user.blocked && (
            <button onClick={onBlock} className="px-4 py-2 rounded-xl bg-[#E05B55] hover:bg-[#D04A44] text-white text-xs font-semibold">Khóa vĩnh viễn</button>
          )}
        </div>
      </div>
    </div>
  );
}

/** "Tạm khóa" dialog text for the person's next level. */
export function suspendPromptOptions(name: string, stats?: CancelStats) {
  const length = hoursLabel(stats?.nextHours) || 'theo mức tiếp theo';
  return {
    title: `Tạm khóa ${name}${stats?.nextLevel ? ` (lần ${stats.nextLevel})` : ''}?`,
    message: `Khóa ${length}: vẫn đăng nhập được nhưng không đặt/nhận đơn mới, hết giờ tự mở. Tái phạm sẽ bị khóa lâu hơn.${stats?.needsReview ? ' Người này đã vượt mức cuối, nên cân nhắc khóa vĩnh viễn.' : ''} Người dùng thấy lý do bên dưới.`,
    placeholder: 'Lý do tạm khóa (bắt buộc, người dùng sẽ thấy)',
    confirmText: 'Tạm khóa',
    tone: 'warning' as const,
    required: true,
  };
}
