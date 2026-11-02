import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { request } from '../api/client';

type Customer = { id: string; displayName?: string | null; avatarUrl?: string | null; phoneNumber?: string | null; email?: string | null };

export function SupportCustomerPicker({ onClose, onSelect, busy }: {
  onClose: () => void; onSelect: (customerId: string) => Promise<void>; busy: boolean;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ role: 'CUSTOMER', status: 'ACTIVE', page: String(page), limit: '20', search });
        const data = await request<{ items: Customer[]; total: number }>(`/admin/marketplace/users?${params}`, { signal: controller.signal });
        if (!controller.signal.aborted) { setRows(data.items); setTotal(data.total); setError(''); }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Không tải được khách hàng');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, page]);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="support-picker-title">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-xl">
        <div className="p-5 border-b flex items-center justify-between">
          <div><h2 id="support-picker-title" className="font-bold text-lg">Chọn khách để chat hỗ trợ</h2><p className="text-xs text-[#66756B] mt-1">Mở lại lịch sử nếu khách đã có hội thoại CSKH.</p></div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Đóng" className="p-2 bg-transparent text-content-secondary"><X size={20} /></button>
        </div>
        <div className="p-4 relative"><Search className="absolute left-7 top-7 text-[#94A399]" size={16} /><input autoFocus value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Tên, số điện thoại, email hoặc ID user..." aria-label="Tìm khách hàng để chat" className="w-full border rounded-xl pl-10 pr-3 py-2.5 text-sm" /></div>
        <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-2">
          {error && <p role="alert" className="text-red-700 text-sm">{error}</p>}
          {loading ? <p className="text-sm p-4">Đang tìm khách...</p> : !error && rows.length === 0 ? <p className="text-sm p-4">Không tìm thấy khách hàng.</p> : !error && rows.map((customer) => (
            <button type="button" key={customer.id} disabled={busy} onClick={() => void onSelect(customer.id)} className="w-full text-left border rounded-xl p-3 hover:bg-green-50 disabled:opacity-50">
              <p className="font-semibold text-sm">{customer.displayName || 'Khách chưa cập nhật tên'}</p>
              <p className="text-xs text-[#66756B] mt-1">{[customer.phoneNumber, customer.email].filter(Boolean).join(' · ') || 'Chưa có liên hệ'}</p>
              <p className="text-[11px] text-[#94A399] mt-1 break-all">{customer.id}</p>
            </button>
          ))}
        </div>
        <div className="p-4 border-t flex justify-between items-center text-xs"><button disabled={page === 1 || loading || busy} onClick={() => setPage((p) => p - 1)} className="border rounded-lg p-2 disabled:opacity-40">Trước</button><span>Trang {page} · {total} khách</span><button disabled={page * 20 >= total || loading || busy} onClick={() => setPage((p) => p + 1)} className="border rounded-lg p-2 disabled:opacity-40">Sau</button></div>
      </div>
    </div>
  );
}
