import { useState } from 'react';
import { request } from '../api/client';

export function ContractTemplatesPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const file = new FormData(event.currentTarget).get('file');
    if (!(file instanceof File) || file.type !== 'application/pdf') { setMessage('Vui lòng chọn file PDF'); return; }
    setBusy(true); setMessage('');
    try { const signed = await request<{ uploadUrl: string; storageKey: string }>('/admin/technician-contracts/template-upload-url', { method: 'POST', body: JSON.stringify({ fileName: file.name, contentType: file.type }) }); const put = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file }); if (!put.ok) throw new Error('Upload S3 thất bại'); await request('/admin/technician-contracts/template', { method: 'PATCH', body: JSON.stringify({ storageKey: signed.storageKey, fileName: file.name, contentType: file.type }) }); setMessage('Đã cập nhật mẫu hợp đồng thành công'); event.currentTarget.reset(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Không tải được mẫu hợp đồng'); } finally { setBusy(false); }
  }
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Mẫu hợp đồng KTV</h1><p className="text-sm text-gray-500">Upload PDF để KTV xem và ký trên mobile.</p></div><div className="bg-white border rounded-2xl p-6 max-w-2xl"><form onSubmit={upload} className="space-y-4"><label className="block font-semibold">File hợp đồng PDF<input className="block w-full mt-2 border rounded-xl p-3" type="file" name="file" accept="application/pdf" required /></label><button disabled={busy} className="w-full rounded-xl bg-[#2E7D4A] text-white font-bold py-3">{busy ? 'Đang tải...' : 'Tải lên và đặt làm mẫu hiện hành'}</button>{message && <p className="text-sm text-gray-600">{message}</p>}</form></div></div>;
}
