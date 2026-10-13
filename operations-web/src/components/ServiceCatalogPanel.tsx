import { FormEvent, useEffect, useState } from 'react';
import { request } from '../api/client';
import { Card } from './Card';
import { FormCard } from './Form';

type Category = { id: string; name: string };
type PriceOption = { id: string; code: string; durationMinutes: number; price: number; isActive: boolean };
type CatalogItem = { id: string; slug: string; name: string; isActive: boolean; priceOptions: PriceOption[] };
const templates: Record<string, number[]> = { FIXED_60: [60], STANDARD_60_90_120: [60, 90, 120], DATE_2_4_6_HOURS: [120, 240, 360] };

export function ServiceCatalogPanel({ categories, notify }: { categories: Category[]; notify: (message: string, error?: boolean) => void }) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [template, setTemplate] = useState('FIXED_60');
  const [prices, setPrices] = useState<Record<number, string>>({});
  async function load() {
    try { setItems(await request<CatalogItem[]>('/admin/service-catalog')); }
    catch (e) { notify(e instanceof Error ? e.message : 'Không tải được catalog', true); }
  }
  useEffect(() => { void load(); }, []);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const durations = templates[template];
    try {
      await request('/admin/service-catalog', { method: 'POST', body: JSON.stringify({
        categoryId: f.get('categoryId'), slug: f.get('slug'), name: f.get('name'), description: f.get('description') || undefined,
        pricingTemplate: template, modes: ['HOME'],
        priceOptions: durations.map((duration, index) => ({ code: duration + '_MINUTES', durationMinutes: duration, price: Number(prices[duration] || 0), sortOrder: index })),
      })});
      event.currentTarget.reset(); setPrices({}); notify('Đã tạo dịch vụ catalog'); await load();
    } catch (e) { notify(e instanceof Error ? e.message : 'Không tạo được dịch vụ', true); }
  }
  async function toggle(item: CatalogItem) {
    try { await request('/admin/service-catalog/' + item.id, { method: 'PATCH', body: JSON.stringify({ isActive: !item.isActive }) }); await load(); }
    catch (e) { notify(e instanceof Error ? e.message : 'Không cập nhật được dịch vụ', true); }
  }
  async function remove(item: CatalogItem) {
    if (!window.confirm('Ẩn dịch vụ “' + item.name + '”?')) return;
    try { await request('/admin/service-catalog/' + item.id, { method: 'DELETE' }); await load(); }
    catch (e) { notify(e instanceof Error ? e.message : 'Không ẩn được dịch vụ', true); }
  }
  const durations = templates[template];
  return <div className="grid two">
    <Card title="Catalog dịch vụ" subtitle="KTV chỉ được chọn dịch vụ và giá từ danh sách này.">
      <FormCard onSubmit={create}>
        <label>Danh mục<select name="categoryId" required><option value="">Chọn danh mục</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label>Tên dịch vụ<input name="name" required maxLength={150} /></label>
        <label>Mã định danh (slug)<input name="slug" required maxLength={100} /></label>
        <label>Mô tả<textarea name="description" rows={3} /></label>
        <label>Mẫu giá<select value={template} onChange={(e) => { setTemplate(e.target.value); setPrices({}); }}>{Object.keys(templates).map((key) => <option key={key}>{key}</option>)}</select></label>
        {durations.map((duration) => <label key={duration}>Giá {duration} phút<input type="number" min="0" required value={prices[duration] || ''} onChange={(e) => setPrices({ ...prices, [duration]: e.target.value })} /></label>)}
        <button>Tạo dịch vụ</button>
      </FormCard>
    </Card>
    <Card title="Dịch vụ đã cấu hình" subtitle={items.length + ' dịch vụ'}>
      <div className="item-list">{items.map((item) => <div className="list-item-card" key={item.id}>
        <div><div className="item-name">{item.name}</div><div className="item-subtext">{item.slug} · {item.priceOptions.map((p) => p.durationMinutes + ' phút: ' + p.price.toLocaleString('vi-VN') + ' đ').join(' · ')}</div></div>
        <div className="button-row"><button className="quiet" onClick={() => void toggle(item)}>{item.isActive ? 'Ẩn' : 'Hiện'}</button><button className="quiet danger-text" onClick={() => void remove(item)}>Xóa</button></div>
      </div>)}</div>
    </Card>
  </div>;
}
