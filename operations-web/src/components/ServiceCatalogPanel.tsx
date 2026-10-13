import { FormEvent, useEffect, useMemo, useState } from 'react';
import { request } from '../api/client';
import { Card } from './Card';

type Category = { id: string; name: string };
type PriceOption = { id: string; code: string; durationMinutes: number; price: number; isActive: boolean };
type CatalogItem = { id: string; categoryId: string; category?: { id: string; name: string } | null; slug: string; name: string; description?: string | null; pricingTemplate: string; isActive: boolean; priceOptions: PriceOption[] };
const templates: Record<string, number[]> = { FIXED_60: [60], STANDARD_60_90_120: [60, 90, 120], DATE_2_4_6_HOURS: [120, 240, 360] };

export function ServiceCatalogPanel({ categories, notify }: { categories: Category[]; notify: (message: string, error?: boolean) => void }) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [editor, setEditor] = useState<CatalogItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [template, setTemplate] = useState('STANDARD_60_90_120');
  const [prices, setPrices] = useState<Record<number, string>>({});
  async function load() { try { setItems(await request<CatalogItem[]>('/admin/service-catalog')); } catch (e) { notify(e instanceof Error ? e.message : 'Không tải được catalog', true); } }
  useEffect(() => { void load(); }, []);
  function openCreate() { setTemplate('STANDARD_60_90_120'); setPrices({}); setCreating(true); }
  function openEdit(item: CatalogItem) { setTemplate(item.pricingTemplate); setPrices(Object.fromEntries(item.priceOptions.map((p) => [p.durationMinutes, String(p.price)]))); setEditor(item); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const durations = templates[template];
    const body = { categoryId: form.get('categoryId'), slug: form.get('slug'), name: form.get('name'), description: form.get('description') || undefined, pricingTemplate: template, modes: ['HOME'], priceOptions: durations.map((duration, index) => ({ code: duration + '_MINUTES', durationMinutes: duration, price: Number(prices[duration] || 0), sortOrder: index })) };
    try { await request(creating ? '/admin/service-catalog' : '/admin/service-catalog/' + editor?.id, { method: creating ? 'POST' : 'PATCH', body: JSON.stringify(body) }); notify(creating ? 'Đã tạo dịch vụ' : 'Đã cập nhật dịch vụ'); setCreating(false); setEditor(null); await load(); } catch (e) { notify(e instanceof Error ? e.message : 'Không lưu được dịch vụ', true); }
  }
  async function toggle(item: CatalogItem) { const action = item.isActive ? 'ẩn' : 'hiện'; if (!window.confirm(`Bạn muốn ${action} dịch vụ “${item.name}” (${item.slug})?`)) return; try { await request('/admin/service-catalog/' + item.id, { method: 'PATCH', body: JSON.stringify({ isActive: !item.isActive }) }); notify(`Đã ${action} dịch vụ`); await load(); } catch (e) { notify(e instanceof Error ? e.message : 'Không cập nhật được dịch vụ', true); } }
  async function remove(item: CatalogItem) { if (!window.confirm(`Xóa dịch vụ “${item.name}” khỏi catalog?\n\nMã: ${item.slug}\nDanh mục: ${item.category?.name ?? 'Chưa phân loại'}\n\nKTV sẽ không thể chọn dịch vụ này nữa.`)) return; try { await request('/admin/service-catalog/' + item.id, { method: 'DELETE' }); notify('Đã xóa dịch vụ'); await load(); } catch (e) { notify(e instanceof Error ? e.message : 'Không xóa được dịch vụ', true); } }
  async function seedDefaults() { try { const result = await request<{ created: number; total: number }>('/admin/service-catalog/seed-defaults', { method: 'POST' }); notify(`Đã tạo ${result.created} dịch vụ mẫu`); await load(); } catch (e) { notify(e instanceof Error ? e.message : 'Không tạo được bộ dịch vụ mẫu', true); } }
  const visibleItems = useMemo(() => items.filter((item) => (!activeOnly || item.isActive) && (!search.trim() || `${item.name} ${item.slug}`.toLowerCase().includes(search.trim().toLowerCase()))), [items, activeOnly, search]);
  const durations = templates[template]; const editItem = editor ?? undefined;
  return <div className="catalog-page">
    <Card title="Catalog dịch vụ" subtitle={`${visibleItems.length}/${items.length} dịch vụ`} headerAction={<div className="catalog-header-actions"><button className="quiet" type="button" onClick={() => void seedDefaults()}>Tạo bộ mẫu</button><button type="button" onClick={openCreate}>Thêm dịch vụ</button></div>}>
      <div className="catalog-toolbar"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên hoặc mã dịch vụ..." /><label className="check-row"><input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} /> Chỉ hiện đang dùng</label></div>
      <div className="item-list">{visibleItems.map((item) => <div className="list-item-card" key={item.id}><div><div className="item-name">{item.name} {!item.isActive && <span className="status-pill">Đang ẩn</span>}</div><div className="item-category">{item.category?.name ?? 'Chưa phân loại'}</div><div className="item-subtext">Mã: {item.slug} · {item.priceOptions.map((p) => `${p.durationMinutes} phút: ${p.price.toLocaleString('vi-VN')} đ`).join(' · ')}</div></div><div className="button-row"><button className="quiet" onClick={() => openEdit(item)}>Sửa</button><button className="quiet" onClick={() => void toggle(item)}>{item.isActive ? 'Ẩn' : 'Hiện'}</button><button className="quiet danger-text" onClick={() => void remove(item)}>Xóa</button></div></div>)}</div>
      {!visibleItems.length && <div className="empty-state">Chưa có dịch vụ phù hợp. Hãy thêm dịch vụ mới hoặc bỏ bộ lọc.</div>}
    </Card>
    {(creating || editItem) && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) { setCreating(false); setEditor(null); } }}><div className="application-modal catalog-editor"><div className="modal-header"><div><h2>{creating ? 'Thêm dịch vụ' : 'Sửa dịch vụ'}</h2><p className="card-subtitle">Giá và thông tin này áp dụng cho toàn hệ thống.</p></div><button className="quiet" type="button" onClick={() => { setCreating(false); setEditor(null); }}>Đóng</button></div><form className="form-grid" onSubmit={save}>
      <label>Danh mục<select name="categoryId" defaultValue={editItem?.categoryId ?? ''} required><option value="">Chọn danh mục</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Tên dịch vụ<input name="name" defaultValue={editItem?.name ?? ''} required maxLength={150} /></label><label>Mã định danh (slug)<input name="slug" defaultValue={editItem?.slug ?? ''} required maxLength={100} /></label><label>Mô tả<textarea name="description" defaultValue={editItem?.description ?? ''} rows={3} /></label><label>Mẫu giá<select value={template} onChange={(e) => { setTemplate(e.target.value); setPrices({}); }}>{Object.keys(templates).map((key) => <option key={key}>{key}</option>)}</select></label>{durations.map((duration) => <label key={duration}>Giá {duration} phút<input type="number" min="0" required value={prices[duration] ?? ''} onChange={(e) => setPrices({ ...prices, [duration]: e.target.value })} /></label>)}<div className="modal-actions"><button className="quiet" type="button" onClick={() => { setCreating(false); setEditor(null); }}>Hủy</button><button type="submit">{creating ? 'Tạo dịch vụ' : 'Lưu thay đổi'}</button></div>
    </form></div></div>}
  </div>;
}
