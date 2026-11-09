import React, { useCallback, useEffect, useState } from 'react';
import { Check, Images, RefreshCw, X } from 'lucide-react';
import { request } from '../api/client';
import { PageHeader } from '../components/common/PageHeader';
import { useToast } from '../components/ui/ToastContainer';
import { Badge, Button } from '../components/ui/kit';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED';
type Photo = {
  id: string;
  kind: 'GALLERY' | 'CERTIFICATE';
  status: Status;
  rejectionReason: string | null;
  createdAt: string;
  viewUrl: string;
  technician: { userId: string; displayName: string | null; avatarUrl: string | null; applicationStatus: string };
};

const TABS: Array<{ status: Status; label: string }> = [
  { status: 'PENDING', label: 'Chờ duyệt' },
  { status: 'APPROVED', label: 'Đã duyệt' },
  { status: 'REJECTED', label: 'Đã từ chối' },
];
const date = (value: string) =>
  new Date(value).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Profile photos and certificates technicians add after approval; customers only see the approved ones. */
export function TechnicianPhotosPage() {
  const { addToast } = useToast();
  const [status, setStatus] = useState<Status>('PENDING');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPhotos(await request<Photo[]>(`/admin/marketplace/technician-photos?status=${status}`));
    } catch (error) {
      addToast({ type: 'error', title: 'Không tải được danh sách ảnh', message: error instanceof Error ? error.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [addToast, status]);
  useEffect(() => {
    void load();
  }, [load]);

  const review = async (photo: Photo, next: 'APPROVED' | 'REJECTED') => {
    if (next === 'REJECTED' && !reason.trim()) return addToast({ type: 'error', title: 'Nhập lý do từ chối để KTV biết cần sửa gì' });
    setBusy(photo.id);
    try {
      await request(`/admin/marketplace/technician-photos/${photo.id}`, {
        method: 'PATCH',
        body: JSON.stringify(next === 'REJECTED' ? { status: next, reason: reason.trim() } : { status: next }),
      });
      addToast({ type: 'success', title: next === 'APPROVED' ? 'Đã duyệt, khách đã thấy ảnh' : 'Đã từ chối và báo cho KTV' });
      setRejecting(null);
      setReason('');
      setPhotos((current) => current.filter((item) => item.id !== photo.id));
    } catch (error) {
      addToast({ type: 'error', title: 'Không cập nhật được', message: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Duyệt ảnh KTV"
        subtitle="Ảnh hồ sơ và chứng chỉ KTV thêm sau khi đã được duyệt. Ảnh gửi kèm hồ sơ đăng ký được duyệt cùng hồ sơ. Khách chỉ thấy ảnh đã duyệt."
        icon={<Images className="w-5 h-5" />}
        actions={<Button onClick={() => void load()} loading={loading} icon={<RefreshCw className="w-4 h-4" />}>Làm mới</Button>}
      />

      <div className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.status}
            type="button"
            onClick={() => setStatus(tab.status)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
              status === tab.status ? 'bg-primary text-white border-primary' : 'bg-white text-content-secondary border-surface-border hover:bg-surface-subtle'
            }`}
          >
            {tab.label}
            {tab.status === status && !loading ? ` (${photos.length})` : ''}
          </button>
        ))}
      </div>

      {loading && !photos.length ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[0, 1, 2, 3].map((key) => <div key={key} className="aspect-square rounded-2xl bg-surface-subtle animate-pulse" />)}</div>
      ) : !photos.length ? (
        <div className="py-14 text-center rounded-2xl border border-surface-border bg-white">
          <Images className="w-10 h-10 mx-auto text-primary" />
          <p className="mt-3 font-semibold text-content-primary">{status === 'PENDING' ? 'Không có ảnh nào chờ duyệt' : 'Chưa có ảnh'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="rounded-2xl border border-surface-border bg-white overflow-hidden flex flex-col">
              <a href={photo.viewUrl} target="_blank" rel="noreferrer" className="block aspect-square bg-surface-subtle">
                <img src={photo.viewUrl} alt="" className="w-full h-full object-cover" />
              </a>
              <div className="p-3 space-y-2 flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-content-primary truncate">{photo.technician.displayName ?? 'KTV'}</span>
                  <Badge tone={photo.kind === 'CERTIFICATE' ? 'blue' : 'gray'}>{photo.kind === 'CERTIFICATE' ? 'Chứng chỉ' : 'Ảnh hồ sơ'}</Badge>
                </div>
                <p className="text-xs text-content-tertiary">Gửi lúc {date(photo.createdAt)}</p>
                {photo.rejectionReason && <p className="text-xs text-[#B9403A]">Lý do: {photo.rejectionReason}</p>}
                {status === 'PENDING' && (
                  <div className="mt-auto space-y-2">
                    {rejecting === photo.id ? (
                      <>
                        <textarea
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          placeholder="Lý do, ví dụ: ảnh mờ, không phải chứng chỉ…"
                          maxLength={500}
                          rows={2}
                          className="w-full px-3 py-2 rounded-xl bg-surface-subtle border border-surface-border text-xs focus:outline-none focus:border-primary"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" variant="danger" loading={busy === photo.id} onClick={() => void review(photo, 'REJECTED')}>Xác nhận từ chối</Button>
                          <Button size="sm" variant="ghost" onClick={() => setRejecting(null)}>Hủy</Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <Button size="sm" variant="primary" loading={busy === photo.id} icon={<Check className="w-4 h-4" />} onClick={() => void review(photo, 'APPROVED')}>Duyệt</Button>
                        <Button size="sm" variant="ghost" icon={<X className="w-4 h-4" />} onClick={() => { setRejecting(photo.id); setReason(''); }}>Từ chối</Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TechnicianPhotosPage;
