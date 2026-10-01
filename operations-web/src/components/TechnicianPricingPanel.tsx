import { FormEvent, useEffect, useState } from 'react';
import { request } from '../api/client';
import { Card } from './Card';

type Technician = { id: string; user: { displayName: string | null } };
type PriceOption = { id: string; durationMinutes: number; price: number; isActive: boolean };
type TechnicianService = { id: string; name: string; category: { name: string }; priceOptions: PriceOption[] };
type ServiceResponse = { services: TechnicianService[] };

export function TechnicianPricingPanel({ technicians, notify }: { technicians: Technician[]; notify: (message: string, error?: boolean) => void }) {
  const [technicianId, setTechnicianId] = useState('');
  const [services, setServices] = useState<TechnicianService[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load(id: string) {
    if (!id) { setServices([]); return; }
    setLoading(true);
    try { setServices((await request<ServiceResponse>(`/admin/marketplace/technicians/${id}/services`)).services); }
    catch (error) { notify(error instanceof Error ? error.message : 'Không tải được bảng giá', true); setServices([]); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(technicianId); }, [technicianId]);

  async function save(event: FormEvent<HTMLFormElement>, serviceId: string, optionId: string) {
    event.preventDefault();
    const price = Number(new FormData(event.currentTarget).get('price'));
    if (!Number.isFinite(price) || price < 0) { notify('Giá phải là số tiền không âm.', true); return; }
    setSavingId(optionId);
    try {
      await request(`/admin/marketplace/technicians/${technicianId}/services/${serviceId}/price-options/${optionId}`, { method: 'PATCH', body: JSON.stringify({ price }) });
      notify('Đã cập nhật giá dịch vụ.'); await load(technicianId);
    } catch (error) { notify(error instanceof Error ? error.message : 'Không thể cập nhật giá', true); }
    finally { setSavingId(null); }
  }

  return <Card title="Bảng giá dịch vụ KTV" subtitle="Admin chỉ sửa giá bán của từng gói; thời lượng giữ theo template dịch vụ.">
    <div className="form-grid pricing-picker"><label>Kỹ thuật viên<select value={technicianId} onChange={(event) => setTechnicianId(event.target.value)}><option value="">Chọn kỹ thuật viên</option>{technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.user.displayName ?? tech.id}</option>)}</select></label></div>
    {loading && <p className="muted">Đang tải bảng giá…</p>}
    {!loading && technicianId && <div className="item-list pricing-list">{services.length === 0 && <p className="muted">KTV này chưa cấu hình dịch vụ nào.</p>}{services.map((service) => <section className="pricing-service" key={service.id}><strong>{service.name}</strong><p className="item-subtext">{service.category.name}</p>{service.priceOptions.length === 0 ? <p className="muted">Dịch vụ chưa có gói giá.</p> : <div className="pricing-options">{service.priceOptions.map((option) => <form key={option.id} className="pricing-option" onSubmit={(event) => void save(event, service.id, option.id)}><span>{option.durationMinutes} phút{!option.isActive ? ' · Đang ẩn' : ''}</span><label>Giá (VND)<input name="price" type="number" min="0" step="1000" defaultValue={option.price} required /></label><button type="submit" disabled={savingId === option.id}>{savingId === option.id ? 'Đang lưu…' : 'Lưu giá'}</button></form>)}</div>}</section>)}</div>}
  </Card>;
}
