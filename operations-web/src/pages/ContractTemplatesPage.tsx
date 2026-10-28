import { useState } from 'react';
import { request } from '../api/client';

export function ContractTemplatesPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const file = new FormData(formElement).get('file');
    if (!(file instanceof File) || file.type !== 'application/pdf') { setMessage('Vui lòng chọn file PDF'); return; }
    setBusy(true); setMessage('');
    try { const form = new FormData(); form.append('file', file); await request('/admin/technician-contracts/template-upload', { method: 'POST', body: form }); setMessage('Đã cập nhật mẫu hợp đồng thành công'); formElement.reset(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Không tải được mẫu hợp đồng'); } finally { setBusy(false); }
  }
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Mẫu hợp đồng KTV</h1><p className="text-sm text-gray-500">Upload PDF để KTV xem và ký trên mobile.</p></div><div className="bg-white border rounded-2xl p-6 max-w-2xl"><form onSubmit={upload} className="space-y-4"><label className="block font-semibold">File hợp đồng PDF<input className="block w-full mt-2 border rounded-xl p-3" type="file" name="file" accept="application/pdf" required /></label><button disabled={busy} className="w-full rounded-xl bg-[#2E7D4A] text-white font-bold py-3">{busy ? 'Đang tải...' : 'Tải lên và đặt làm mẫu hiện hành'}</button>{message && <p className="text-sm text-gray-600">{message}</p>}</form></div></div>;
}
