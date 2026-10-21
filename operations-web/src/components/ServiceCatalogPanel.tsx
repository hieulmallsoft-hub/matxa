import { FormEvent, useEffect, useMemo, useState } from 'react';
import { request } from '../api/client';
import { Card } from './Card';

type Category = { id: string; name: string };
type PriceOption = { id: string; code: string; durationMinutes: number; price: number; isActive: boolean };
type CatalogItem = {
  id: string;
  categoryId: string;
  category?: { id: string; name: string } | null;
  slug: string;
  name: string;
  description?: string | null;
  pricingTemplate: string;
  modes: string[];
  isActive: boolean;
  priceOptions: PriceOption[];
};

const templateOptions = [
  { value: 'FIXED_60', label: 'Một mức giá', detail: '60 phút' },
  { value: 'STANDARD_60_90_120', label: 'Theo thời lượng', detail: '60 / 90 / 120 phút' },
  { value: 'DATE_2_4_6_HOURS', label: 'Theo số giờ', detail: '2 / 4 / 6 tiếng' },
] as const;
const templates: Record<string, number[]> = {
  FIXED_60: [60],
  STANDARD_60_90_120: [60, 90, 120],
  DATE_2_4_6_HOURS: [120, 240, 360],
};
const modeOptions = [
  { value: 'HOME', label: 'Phục vụ tận nơi' },
  { value: 'ONSITE', label: 'Tại cơ sở' },
  { value: 'ONLINE', label: 'Online' },
] as const;

export function ServiceCatalogPanel({ categories, notify }: { categories: Category[]; notify: (message: string, error?: boolean) => void }) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [editor, setEditor] = useState<CatalogItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [template, setTemplate] = useState('STANDARD_60_90_120');
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [modes, setModes] = useState<string[]>(['HOME']);

  async function load() {
    try {
      setItems(await request<CatalogItem[]>('/admin/service-catalog'));
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Không tải được catalog', true);
    }
  }
  useEffect(() => { void load(); }, []);

  function openCreate() {
    setTemplate('STANDARD_60_90_120');
    setPrices({});
    setModes(['HOME']);
    setCreating(true);
  }
  function openEdit(item: CatalogItem) {
    setTemplate(item.pricingTemplate);
    setPrices(Object.fromEntries(item.priceOptions.map((p) => [p.durationMinutes, String(p.price)])));
    setModes(item.modes?.length ? item.modes : ['HOME']);
    setEditor(item);
  }
  function closeEditor() { setCreating(false); setEditor(null); }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const durations = templates[template];
    const body = {
      categoryId: form.get('categoryId'),
      slug: form.get('slug'),
      name: form.get('name'),
      description: form.get('description') || undefined,
      pricingTemplate: template,
      modes,
      priceOptions: durations.map((duration, index) => ({
        code: template === 'DATE_2_4_6_HOURS' ? `${duration / 60}_HOURS` : `${duration}_MINUTES`,
        durationMinutes: duration,
        price: Number(prices[duration] || 0),
        sortOrder: index,
      })),
    };
    try {
      await request(creating ? '/admin/service-catalog' : `/admin/service-catalog/${editor?.id}`, { method: creating ? 'POST' : 'PATCH', body: JSON.stringify(body) });
      notify(creating ? 'Đã tạo dịch vụ' : 'Đã cập nhật dịch vụ');
      closeEditor();
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Không lưu được dịch vụ', true);
    }
  }
  async function toggle(item: CatalogItem) {
    const action = item.isActive ? 'ẩn' : 'hiện';
    if (!window.confirm(`Bạn muốn ${action} dịch vụ “${item.name}” không?`)) return;
    try {
      await request(`/admin/service-catalog/${item.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !item.isActive }) });
      notify(`Đã ${action} dịch vụ`);
      await load();
    } catch (e) { notify(e instanceof Error ? e.message : 'Không cập nhật được dịch vụ', true); }
  }
  async function remove(item: CatalogItem) {
    if (!window.confirm(`Xóa dịch vụ “${item.name}” khỏi catalog?`)) return;
    try {
      await request(`/admin/service-catalog/${item.id}`, { method: 'DELETE' });
      notify('Đã xóa dịch vụ');
      await load();
    } catch (e) { notify(e instanceof Error ? e.message : 'Không xóa được dịch vụ', true); }
  }
  async function seedDefaults() {
    try {
      const result = await request<{ created: number; total: number }>('/admin/service-catalog/seed-defaults', { method: 'POST' });
      notify(`Đã tạo ${result.created} dịch vụ mẫu`);
      await load();
    } catch (e) { notify(e instanceof Error ? e.message : 'Không tạo được bộ dịch vụ mẫu', true); }
  }

  const visibleItems = useMemo(() => items.filter((item) => (!activeOnly || item.isActive) && (!search.trim() || `${item.name} ${item.slug}`.toLowerCase().includes(search.trim().toLowerCase()))), [items, activeOnly, search]);
  const durations = templates[template];
  const editItem = editor ?? undefined;

  return <div className="catalog-page">
    <Card title="Catalog dịch vụ" subtitle={`${visibleItems.length}/${items.length} dịch vụ`} headerAction={<div className="catalog-header-actions"><button className="quiet" type="button" onClick={() => void seedDefaults()}>Tạo bộ mẫu</button><button type="button" onClick={openCreate}>Thêm dịch vụ</button></div>}>
      <div className="catalog-toolbar"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên hoặc mã dịch vụ..." /><label className="check-row"><input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} /> Chỉ hiện đang dùng</label></div>
      <div className="item-list">{visibleItems.map((item) => <div className="list-item-card" key={item.id}><div><div className="item-name">{item.name} {!item.isActive && <span className="status-pill">Đang ẩn</span>}</div><div className="item-category">{item.category?.name ?? 'Chưa phân loại'}</div><div className="item-subtext">{item.priceOptions.map((p) => `${p.durationMinutes >= 120 && item.pricingTemplate === 'DATE_2_4_6_HOURS' ? `${p.durationMinutes / 60} tiếng` : `${p.durationMinutes} phút`}: ${p.price.toLocaleString('vi-VN')} đ`).join(' · ')}</div></div><div className="button-row"><button className="quiet" onClick={() => openEdit(item)}>Sửa</button><button className="quiet" onClick={() => void toggle(item)}>{item.isActive ? 'Ẩn' : 'Hiện'}</button><button className="quiet danger-text" onClick={() => void remove(item)}>Xóa</button></div></div>)}</div>
      {!visibleItems.length && <div className="empty-state">Chưa có dịch vụ phù hợp.</div>}
    </Card>
    {(creating || editItem) && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeEditor(); }}><div className="application-modal catalog-editor"><div className="modal-header"><div><h2>{creating ? 'Thêm dịch vụ' : 'Sửa dịch vụ'}</h2><p className="card-subtitle">Cấu hình dịch vụ dùng chung cho toàn hệ thống.</p></div><button className="quiet" type="button" onClick={closeEditor}>Đóng</button></div><form className="form-grid" onSubmit={save}>
      <label>Danh mục<select name="categoryId" defaultValue={editItem?.categoryId ?? ''} required><option value="">Chọn danh mục</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Tên dịch vụ<input name="name" defaultValue={editItem?.name ?? ''} required maxLength={150} /></label>
      <label>Mã định danh<input name="slug" defaultValue={editItem?.slug ?? ''} required maxLength={100} /></label>
      <label>Mô tả<textarea name="description" defaultValue={editItem?.description ?? ''} rows={3} /></label>
      <fieldset className="template-picker"><legend>Mẫu giá</legend><div className="template-cards">{templateOptions.map((option) => <button type="button" key={option.value} className={`template-card ${template === option.value ? 'selected' : ''}`} onClick={() => { setTemplate(option.value); setPrices({}); }}><span className="template-card-title">{option.label}</span><span className="template-card-detail">{option.detail}</span></button>)}</div></fieldset>
      <fieldset className="template-picker"><legend>Nơi phục vụ</legend><div className="mode-cards">{modeOptions.map((option) => <label className={`mode-card ${modes.includes(option.value) ? 'selected' : ''}`} key={option.value}><input type="checkbox" checked={modes.includes(option.value)} onChange={() => setModes((current) => current.includes(option.value) ? current.filter((mode) => mode !== option.value) : [...current, option.value])} /> <span>{option.label}</span></label>)}</div>{!modes.length && <small className="field-error">Chọn ít nhất một nơi phục vụ.</small>}</fieldset>
      <div className="price-grid">{durations.map((duration) => <label key={duration}>Giá {template === 'DATE_2_4_6_HOURS' ? `${duration / 60} tiếng` : `${duration} phút`}<div className="price-input"><input type="number" min="0" required value={prices[duration] ?? ''} onChange={(e) => setPrices({ ...prices, [duration]: e.target.value })} /><span>đ</span></div></label>)}</div>
      <div className="modal-actions"><button className="quiet" type="button" onClick={closeEditor}>Hủy</button><button type="submit" disabled={!modes.length}>{creating ? 'Tạo dịch vụ' : 'Lưu thay đổi'}</button></div>
    </form></div></div>}
  </div>;
}
