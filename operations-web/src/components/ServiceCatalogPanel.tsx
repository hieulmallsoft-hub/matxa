import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Plus,
  Search,
  Edit2,
  Eye,
  EyeOff,
  Trash2,
  Clock,
  Layers,
  Check,
  X,
  Home,
  Store,
  Globe,
  Tag,
  AlertCircle,
  HelpCircle,
  FolderPlus,
} from 'lucide-react';
import { request } from '../api/client';

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
  { value: 'FIXED_60', label: 'Một mức giá', detail: '60 phút', hint: 'Phù hợp dịch vụ cơ bản hoặc liệu trình đơn' },
  { value: 'STANDARD_60_90_120', label: 'Theo thời lượng', detail: '60 / 90 / 120 phút', hint: 'Gói tiêu chuẩn cho massage body, cổ vai gáy' },
  { value: 'DATE_2_4_6_HOURS', label: 'Theo số giờ', detail: '2 / 4 / 6 tiếng', hint: 'Phù hợp các gói dịch vụ dài hạn hoặc đồng hành' },
] as const;

const templates: Record<string, number[]> = {
  FIXED_60: [60],
  STANDARD_60_90_120: [60, 90, 120],
  DATE_2_4_6_HOURS: [120, 240, 360],
};

const modeOptions = [
  { value: 'HOME', label: 'Phục vụ tận nơi', icon: Home, desc: 'KTV đến địa chỉ khách hàng' },
  { value: 'ONSITE', label: 'Tại cơ sở / Spa', icon: Store, desc: 'Khách đến địa điểm spa' },
  { value: 'ONLINE', label: 'Trực tuyến', icon: Globe, desc: 'Tư vấn hoặc khóa học online' },
] as const;

export function ServiceCatalogPanel({
  categories,
  notify,
}: {
  categories: Category[];
  notify: (message: string, error?: boolean) => void;
}) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const [editor, setEditor] = useState<CatalogItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [template, setTemplate] = useState('STANDARD_60_90_120');
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [modes, setModes] = useState<string[]>(['HOME']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setItems(await request<CatalogItem[]>('/admin/service-catalog'));
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Không tải được catalog', true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

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

  function closeEditor() {
    setCreating(false);
    setEditor(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modes.length) {
      notify('Vui lòng chọn ít nhất một nơi phục vụ', true);
      return;
    }

    setIsSubmitting(true);
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
      await request(creating ? '/admin/service-catalog' : `/admin/service-catalog/${editor?.id}`, {
        method: creating ? 'POST' : 'PATCH',
        body: JSON.stringify(body),
      });
      notify(creating ? 'Đã tạo dịch vụ thành công' : 'Đã cập nhật dịch vụ thành công');
      closeEditor();
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Không lưu được dịch vụ', true);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggle(item: CatalogItem) {
    const action = item.isActive ? 'ẩn' : 'kích hoạt';
    try {
      await request(`/admin/service-catalog/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      notify(`Đã ${action} dịch vụ "${item.name}"`);
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Không cập nhật được dịch vụ', true);
    }
  }

  async function remove(item: CatalogItem) {
    if (!window.confirm(`Xóa dịch vụ “${item.name}” khỏi catalog chung? Thao tác này không thể hoàn tác.`)) return;
    try {
      await request(`/admin/service-catalog/${item.id}`, { method: 'DELETE' });
      notify('Đã xóa dịch vụ thành công');
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Không xóa được dịch vụ', true);
    }
  }

  async function seedDefaults() {
    try {
      const result = await request<{ created: number; total: number }>('/admin/service-catalog/seed-defaults', {
        method: 'POST',
      });
      notify(`Đã tạo ${result.created} dịch vụ mẫu mặc định`);
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Không tạo được bộ dịch vụ mẫu', true);
    }
  }

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      const matchActive = !activeOnly || item.isActive;
      const matchCategory = selectedCategory === 'ALL' || item.categoryId === selectedCategory;
      const matchSearch =
        !search.trim() ||
        `${item.name} ${item.slug} ${item.category?.name || ''}`.toLowerCase().includes(search.trim().toLowerCase());
      return matchActive && matchCategory && matchSearch;
    });
  }, [items, activeOnly, selectedCategory, search]);

  const durations = templates[template];
  const editItem = editor ?? undefined;

  return (
    <div className="space-y-6">
      {/* 1. Main Header Card */}
      <div className="bg-white rounded-3xl border border-[#E5EBE5] p-6 sm:p-7 shadow-[0_2px_16px_rgba(28,43,32,0.04)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E5EBE5]">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-[#1C2B20] tracking-tight">Catalog Dịch Vụ Chuẩn</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EAF5EC] text-[#2E7D4A] border border-[#D0E7D5]">
                {items.filter((i) => i.isActive).length}/{items.length} đang dùng
              </span>
            </div>
            <p className="text-xs text-[#66756B] mt-1">
              Danh mục gói dịch vụ spa & trị liệu gốc dùng chung cho toàn hệ thống MATXXA
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => void seedDefaults()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#E5EBE5] hover:bg-[#F6F8F4] text-xs font-semibold text-[#2E7D4A] hover:text-[#256A3E] transition-all shadow-2xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#2E7D4A]" />
              <span>Tạo bộ mẫu chuẩn</span>
            </button>

            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white text-xs font-semibold shadow-sm shadow-[#2E7D4A]/25 transition-all cursor-pointer hover:shadow-md active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>+ Thêm dịch vụ mới</span>
            </button>
          </div>
        </div>

        {/* 2. Filter Bar */}
        <div className="pt-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#94A399] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên dịch vụ, mã định danh..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs text-[#1C2B20] placeholder-[#94A399] focus:outline-none focus:border-[#2E7D4A] focus:bg-white transition-all"
            />
          </div>

          {/* Filter options */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {/* Category Select */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs text-[#1C2B20] font-semibold focus:outline-none focus:border-[#2E7D4A] cursor-pointer"
            >
              <option value="ALL">Tất cả danh mục ({items.length})</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Active Only Toggle */}
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#66756B] select-none cursor-pointer px-3 py-1.5 rounded-xl border border-[#E5EBE5] bg-white hover:bg-[#F6F8F4] transition-colors whitespace-nowrap">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="w-4 h-4 rounded text-[#2E7D4A] accent-[#2E7D4A] cursor-pointer"
              />
              <span>Chỉ hiện đang dùng</span>
            </label>
          </div>
        </div>

        {/* 3. Items List */}
        <div className="mt-5 space-y-3">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2 text-xs text-[#94A399]">
              <div className="w-6 h-6 border-2 border-[#2E7D4A]/30 border-t-[#2E7D4A] rounded-full animate-spin" />
              <span>Đang tải danh mục dịch vụ...</span>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="py-12 text-center rounded-2xl border border-dashed border-[#E5EBE5] bg-[#F6F8F4]/50 space-y-2">
              <Layers className="w-8 h-8 text-[#94A399] mx-auto" />
              <p className="text-xs font-bold text-[#66756B]">Không tìm thấy dịch vụ nào</p>
              <p className="text-[11px] text-[#94A399]">
                Thử thay đổi từ khóa tìm kiếm hoặc bấm &ldquo;Tạo bộ mẫu chuẩn&rdquo; để khởi tạo danh sách mặc định.
              </p>
            </div>
          ) : (
            visibleItems.map((item) => (
              <div
                key={item.id}
                className="group p-4 rounded-2xl border border-[#E5EBE5] bg-white hover:bg-[#F9FAF8] hover:border-[#D0E7D5] hover:shadow-sm transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                {/* Left: Info */}
                <div className="space-y-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="font-bold text-sm text-[#1C2B20] tracking-tight group-hover:text-[#2E7D4A] transition-colors">
                      {item.name}
                    </h3>

                    {/* Status Pill */}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        item.isActive
                          ? 'bg-[#EAF5EC] text-[#2E7D4A] border border-[#D0E7D5]'
                          : 'bg-[#FFF8E7] text-[#D97706] border border-[#FDE68A]'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${item.isActive ? 'bg-[#2E7D4A]' : 'bg-[#D97706]'}`} />
                      {item.isActive ? 'Đang dùng' : 'Đang ẩn'}
                    </span>

                    {/* Category Tag */}
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-[#F1F5EF] text-[#4A574E] border border-[#E5EBE5]">
                      <Tag className="w-3 h-3 text-[#2E7D4A]" />
                      {item.category?.name || 'Chưa phân loại'}
                    </span>

                    {/* Slug */}
                    <span className="text-[11px] font-mono text-[#94A399]">#{item.slug}</span>
                  </div>

                  {/* Price Options Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {item.priceOptions.map((p) => {
                      const durationLabel =
                        p.durationMinutes >= 120 && item.pricingTemplate === 'DATE_2_4_6_HOURS'
                          ? `${p.durationMinutes / 60} tiếng`
                          : `${p.durationMinutes} phút`;
                      return (
                        <span
                          key={p.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20]"
                        >
                          <Clock className="w-3 h-3 text-[#2E7D4A]" />
                          <span>{durationLabel}:</span>
                          <strong className="text-[#2E7D4A] font-bold">
                            {new Intl.NumberFormat('vi-VN').format(p.price)} đ
                          </strong>
                        </span>
                      );
                    })}
                  </div>

                  {/* Modes */}
                  <div className="flex items-center gap-2 text-[11px] text-[#66756B]">
                    <span>Khu vực hỗ trợ:</span>
                    {item.modes.map((mode) => (
                      <span key={mode} className="font-semibold text-[#1C2B20]">
                        {mode === 'HOME' ? '🏠 Tận nơi' : mode === 'ONSITE' ? '🏢 Cơ sở' : '🌐 Online'}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#E5EBE5] bg-white hover:bg-[#EAF5EC] hover:text-[#2E7D4A] hover:border-[#D0E7D5] text-xs font-bold text-[#66756B] transition-all shadow-2xs cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Sửa</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void toggle(item)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                      item.isActive
                        ? 'border-[#E5EBE5] bg-white hover:bg-[#FFF8E7] hover:text-[#D97706] hover:border-[#FDE68A] text-[#66756B]'
                        : 'border-[#D0E7D5] bg-[#EAF5EC] text-[#2E7D4A] hover:bg-[#DDF0E1]'
                    }`}
                  >
                    {item.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{item.isActive ? 'Ẩn' : 'Hiện'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void remove(item)}
                    className="inline-flex items-center gap-1 p-2 rounded-xl border border-transparent hover:border-[#F8D2D0] hover:bg-[#FDF0EF] text-[#94A399] hover:text-[#D04A44] transition-all cursor-pointer"
                    title="Xóa dịch vụ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 4. Modal Editor */}
      <AnimatePresence>
        {(creating || editItem) && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeEditor();
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl bg-white rounded-3xl border border-[#E5EBE5] p-6 sm:p-7 shadow-2xl space-y-6 my-8"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-4 border-b border-[#E5EBE5]">
                <div>
                  <h3 className="text-lg font-bold text-[#1C2B20]">
                    {creating ? 'Thêm dịch vụ mới vào Catalog' : 'Cập nhật dịch vụ'}
                  </h3>
                  <p className="text-xs text-[#66756B] mt-0.5">
                    Cấu hình thông số và mức giá tiêu chuẩn áp dụng trên ứng dụng
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="p-1.5 rounded-xl border border-[#E5EBE5] hover:bg-[#F6F8F4] text-[#66756B] hover:text-[#1C2B20] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={save} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Category */}
                  <div>
                    <label className="block text-xs font-bold text-[#1C2B20] mb-1">
                      Danh mục dịch vụ *
                    </label>
                    <select
                      name="categoryId"
                      defaultValue={editItem?.categoryId ?? ''}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A] focus:bg-white transition-colors"
                    >
                      <option value="">-- Chọn danh mục --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Slug */}
                  <div>
                    <label className="block text-xs font-bold text-[#1C2B20] mb-1">
                      Mã định danh (Slug) *
                    </label>
                    <input
                      name="slug"
                      defaultValue={editItem?.slug ?? ''}
                      required
                      maxLength={100}
                      placeholder="vd: massage-body-da-nong"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-mono text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A] focus:bg-white transition-colors"
                    />
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-bold text-[#1C2B20] mb-1">
                    Tên hiển thị của dịch vụ *
                  </label>
                  <input
                    name="name"
                    defaultValue={editItem?.name ?? ''}
                    required
                    maxLength={150}
                    placeholder="vd: Massage Đá Nóng Himalaya Phục Hồi Chuyên Sâu"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs font-semibold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A] focus:bg-white transition-colors"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-[#1C2B20] mb-1">
                    Mô tả chi tiết liệu trình
                  </label>
                  <textarea
                    name="description"
                    defaultValue={editItem?.description ?? ''}
                    rows={2}
                    placeholder="Mô tả công dụng, đối tượng phù hợp và các bước thực hiện..."
                    className="w-full px-3.5 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A] focus:bg-white transition-colors"
                  />
                </div>

                {/* Template Picker */}
                <div>
                  <label className="block text-xs font-bold text-[#1C2B20] mb-1.5">
                    Mẫu phân phối giá (Thời lượng)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {templateOptions.map((opt) => (
                      <button
                        type="button"
                        key={opt.value}
                        onClick={() => {
                          setTemplate(opt.value);
                          setPrices({});
                        }}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          template === opt.value
                            ? 'border-[#2E7D4A] bg-[#EAF5EC]/60 shadow-2xs'
                            : 'border-[#E5EBE5] bg-white hover:bg-[#F6F8F4]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold ${template === opt.value ? 'text-[#2E7D4A]' : 'text-[#1C2B20]'}`}>
                            {opt.label}
                          </span>
                          {template === opt.value && <Check className="w-3.5 h-3.5 text-[#2E7D4A]" />}
                        </div>
                        <span className="block text-[11px] text-[#66756B] mt-1 font-semibold">
                          {opt.detail}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Modes of Service */}
                <div>
                  <label className="block text-xs font-bold text-[#1C2B20] mb-1.5">
                    Phương thức cung cấp dịch vụ *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {modeOptions.map((mode) => {
                      const Icon = mode.icon;
                      const isSelected = modes.includes(mode.value);
                      return (
                        <label
                          key={mode.value}
                          className={`p-3 rounded-2xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-[#2E7D4A] bg-[#EAF5EC]/50 text-[#2E7D4A]'
                              : 'border-[#E5EBE5] bg-white hover:bg-[#F6F8F4] text-[#1C2B20]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() =>
                              setModes((curr) =>
                                curr.includes(mode.value)
                                  ? curr.filter((m) => m !== mode.value)
                                  : [...curr, mode.value]
                              )
                            }
                            className="hidden"
                          />
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-[#2E7D4A]' : 'text-[#66756B]'}`} />
                          <span className="text-xs font-bold">{mode.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Pricing Inputs */}
                <div className="p-4 rounded-2xl bg-[#F6F8F4] border border-[#E5EBE5] space-y-3">
                  <span className="block text-xs font-bold text-[#1C2B20]">
                    Mức giá tiêu chuẩn (VNĐ)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {durations.map((duration) => {
                      const durationLabel =
                        template === 'DATE_2_4_6_HOURS'
                          ? `${duration / 60} tiếng`
                          : `${duration} phút`;
                      return (
                        <div key={duration}>
                          <label className="block text-[11px] font-semibold text-[#66756B] mb-1">
                            Gói {durationLabel}
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step="10000"
                              required
                              value={prices[duration] ?? ''}
                              onChange={(e) => setPrices({ ...prices, [duration]: e.target.value })}
                              placeholder="vd: 500000"
                              className="w-full pl-3 pr-8 py-2 rounded-xl bg-white border border-[#E5EBE5] text-xs font-bold text-[#1C2B20] focus:outline-none focus:border-[#2E7D4A]"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#94A399]">
                              đ
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E5EBE5]">
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="px-4 py-2.5 rounded-xl border border-[#E5EBE5] bg-white hover:bg-[#F6F8F4] text-xs font-bold text-[#66756B] transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting || !modes.length}
                    className="px-5 py-2.5 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white text-xs font-bold shadow-sm shadow-[#2E7D4A]/25 transition-all cursor-pointer hover:shadow-md"
                  >
                    {isSubmitting ? 'Đang lưu...' : creating ? 'Tạo dịch vụ' : 'Lưu thay đổi'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ServiceCatalogPanel;
