import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  MapPin,
  Star,
  Plus,
  Upload,
  X,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Navigation,
  Image as ImageIcon,
  Sparkles,
  Stethoscope,
  BookOpen,
} from 'lucide-react';
import { request } from '../api/client';
import { useToast } from '../components/ui/ToastContainer';

type Category = 'MASSAGE_SPA' | 'CONSULTATION' | 'TRAINING';
type Service = { name: string; durationMinutes: number; price: number; catalogServiceId?: string };
type Hour = { dayOfWeek: number; openTime?: string | null; closeTime?: string | null; isClosed?: boolean };
type Venue = {
  id: string;
  name: string;
  description?: string;
  address: string;
  city: string;
  district?: string;
  category: Category;
  latitude: number;
  longitude: number;
  images: string[];
  services: Service[];
  hours: Hour[];
  rating: number;
  reviewCount: number;
  isActive: boolean;
};
const CATEGORIES = [
  { key: 'MASSAGE_SPA' as Category, label: 'Massage / Spa', icon: Sparkles },
  { key: 'CONSULTATION' as Category, label: 'Phòng tham vấn', icon: Stethoscope },
  { key: 'TRAINING' as Category, label: 'Địa điểm đào tạo', icon: BookOpen },
];
const DAYS = [
  { value: 1, label: 'Thứ Hai' },
  { value: 2, label: 'Thứ Ba' },
  { value: 3, label: 'Thứ Tư' },
  { value: 4, label: 'Thứ Năm' },
  { value: 5, label: 'Thứ Sáu' },
  { value: 6, label: 'Thứ Bảy' },
  { value: 0, label: 'Chủ nhật' },
];
const inputClass =
  'w-full min-w-0 px-3 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-sm focus:outline-none focus:border-[#2E7D4A]';
const actionClass =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-[#E5EBE5] text-xs hover:bg-[#F6F8F4] disabled:opacity-40';
const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
const errorText = (error: unknown) => (error instanceof Error ? error.message : 'Không thể kết nối máy chủ');
const newForm = () => ({
  name: '',
  description: '',
  address: '',
  city: 'HN',
  district: '',
  category: 'MASSAGE_SPA' as Category,
  latitude: '',
  longitude: '',
  images: '',
  isActive: true,
  services: [] as Service[],
  hours: DAYS.map((day): Hour => ({ dayOfWeek: day.value, openTime: '09:00', closeTime: '22:00', isClosed: false })),
});
const normalize = (venue: Venue): Venue => ({
  ...venue,
  category: venue.category || 'MASSAGE_SPA',
  rating: Number(venue.rating || 0),
  reviewCount: Number(venue.reviewCount || 0),
  latitude: Number(venue.latitude),
  longitude: Number(venue.longitude),
  images: venue.images || [],
  hours: venue.hours || [],
  services: (venue.services || []).map((service) => ({ ...service, price: Number(service.price) })),
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-xs font-semibold text-[#66756B] mb-1">{label}</span>
      {children}
    </label>
  );
}

export const VenuesPage: React.FC = () => {
  const { addToast } = useToast();
  const [items, setItems] = useState<Venue[]>([]);
  const [form, setForm] = useState(newForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Venue | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>('MASSAGE_SPA');
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [sort, setSort] = useState('name');
  const [status, setStatus] = useState('all');
  const [locating, setLocating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const uploadCache = useRef(new Map<File, string>());
  const savingRef = useRef(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const venues = await request<Venue[]>('/admin/venues', { signal });
      if (signal?.aborted) return;
      setItems(venues.map(normalize));
      setLoadError('');
    } catch (error) {
      if (!signal?.aborted) setLoadError(errorText(error));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const reset = () => {
    setForm(newForm());
    setEditingId(null);
    setFiles([]);
    setSaveError('');
    uploadCache.current.clear();
    if (fileRef.current) fileRef.current.value = '';
  };
  const edit = (venue: Venue) => {
    if (savingRef.current) return;
    setEditingId(venue.id);
    setSelected(null);
    setSaveError('');
    setFiles([]);
    uploadCache.current.clear();
    if (fileRef.current) fileRef.current.value = '';
    setForm({
      name: venue.name,
      description: venue.description || '',
      address: venue.address,
      city: venue.city,
      district: venue.district || '',
      category: venue.category,
      latitude: String(venue.latitude),
      longitude: String(venue.longitude),
      images: venue.images.join('\n'),
      isActive: venue.isActive,
      services: venue.services.map(({ name, durationMinutes, price, catalogServiceId }) => ({
        name,
        durationMinutes,
        price,
        ...(catalogServiceId ? { catalogServiceId } : {}),
      })),
      hours: DAYS.map((day) => ({
        dayOfWeek: day.value,
        openTime: '09:00',
        closeTime: '22:00',
        isClosed: true,
        ...venue.hours.find((hour) => hour.dayOfWeek === day.value),
      })),
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const textField = (
    key: 'name' | 'description' | 'address' | 'city' | 'district' | 'latitude' | 'longitude' | 'images',
  ) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value })),
  });
  const setHour = (index: number, values: Partial<Hour>) =>
    setForm((current) => ({
      ...current,
      hours: current.hours.map((hour, i) => (i === index ? { ...hour, ...values } : hour)),
    }));
  const setService = (index: number, values: Partial<Service>) =>
    setForm((current) => ({
      ...current,
      services: current.services.map((service, i) => (i === index ? { ...service, ...values } : service)),
    }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;
    setSaveError('');
    const imageUrls = form.images
      .split(/\r?\n/)
      .map((url) => url.trim())
      .filter(Boolean);
    try {
      if (!form.name.trim() || !form.address.trim() || !form.city.trim())
        throw new Error('Nhập tên, địa chỉ và thành phố.');
      if (
        !form.latitude.trim() ||
        !form.longitude.trim() ||
        !Number.isFinite(Number(form.latitude)) ||
        !Number.isFinite(Number(form.longitude))
      )
        throw new Error('Nhập vĩ độ và kinh độ hợp lệ.');
      if (imageUrls.length + files.length > 10) throw new Error('Mỗi địa điểm tối đa 10 ảnh.');
      for (const url of imageUrls)
        if (!/^https?:\/\//i.test(url))
          throw new Error('URL ảnh phải bắt đầu bằng http:// hoặc https://, mỗi dòng một URL.');
      for (const hour of form.hours)
        if (!hour.isClosed && (!hour.openTime || !hour.closeTime || hour.openTime >= hour.closeTime))
          throw new Error('Giờ đóng cửa phải sau giờ mở cửa trong cùng ngày.');
      savingRef.current = true;
      setSubmitting(true);
      const uploaded: string[] = [];
      for (const file of files) {
        let url = uploadCache.current.get(file);
        if (!url) {
          const body = new FormData();
          body.append('file', file);
          const result = await request<{ url: string }>('/admin/venues/images', { method: 'POST', body });
          url = result.url;
          uploadCache.current.set(file, url);
        }
        uploaded.push(url);
      }
      const saved = normalize(
        await request<Venue>(editingId ? `/admin/venues/${editingId}` : '/admin/venues', {
          method: editingId ? 'PATCH' : 'POST',
          body: JSON.stringify({
            ...form,
            name: form.name.trim(),
            address: form.address.trim(),
            city: form.city.trim(),
            district: form.district.trim(),
            latitude: Number(form.latitude),
            longitude: Number(form.longitude),
            images: [...imageUrls, ...uploaded],
            services: form.services.map((service) => ({ ...service, name: service.name.trim() })),
          }),
        }),
      );
      setItems((current) => [saved, ...current.filter((venue) => venue.id !== saved.id)]);
      setCategory(saved.category);
      setCity('');
      setSearch('');
      setStatus('all');
      addToast({ title: editingId ? 'Đã cập nhật địa điểm' : 'Đã thêm địa điểm', type: 'success' });
      reset();
    } catch (error) {
      setSaveError(errorText(error));
    } finally {
      savingRef.current = false;
      setSubmitting(false);
    }
  };

  const remove = async (venue: Venue) => {
    if (!window.confirm(`Xóa địa điểm “${venue.name}”?`)) return;
    setBusyId(venue.id);
    try {
      await request(`/admin/venues/${venue.id}`, { method: 'DELETE' });
      setItems((current) => current.filter((item) => item.id !== venue.id));
      setSelected(null);
      if (editingId === venue.id) reset();
      addToast({ title: 'Đã xóa địa điểm', type: 'success' });
    } catch (error) {
      addToast({ title: 'Không xóa được địa điểm', message: errorText(error), type: 'error' });
    } finally {
      setBusyId(null);
    }
  };
  const toggle = async (venue: Venue) => {
    setBusyId(venue.id);
    try {
      const saved = normalize(
        await request<Venue>(`/admin/venues/${venue.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive: !venue.isActive }),
        }),
      );
      setItems((current) => current.map((item) => (item.id === venue.id ? saved : item)));
      setSelected((current) => (current?.id === saved.id ? saved : current));
      if (editingId === saved.id) setForm((current) => ({ ...current, isActive: saved.isActive }));
      addToast({
        title: saved.isActive ? 'Địa điểm đã hiển thị trên app' : 'Đã ẩn địa điểm khỏi app',
        type: 'success',
      });
    } catch (error) {
      addToast({ title: 'Không đổi được trạng thái', message: errorText(error), type: 'error' });
    } finally {
      setBusyId(null);
    }
  };
  const locate = () => {
    if (!window.isSecureContext || !navigator.geolocation) {
      setSaveError('Trình duyệt cần HTTPS để lấy vị trí. Bạn có thể nhập tọa độ địa điểm trực tiếp từ bản đồ.');
      return;
    }
    setLocating(true);
    setSaveError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
        }));
        setLocating(false);
      },
      () => {
        setLocating(false);
        setSaveError('Không lấy được vị trí. Hãy cấp quyền vị trí hoặc nhập tọa độ trực tiếp.');
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  };
  const selectFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(event.target.files || []);
    if (
      chosen.some(
        (file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024,
      )
    ) {
      setSaveError('Ảnh phải là JPEG, PNG hoặc WebP, tối đa 5 MB mỗi ảnh.');
      event.target.value = '';
      return;
    }
    if (chosen.length > 10) {
      setSaveError('Chọn tối đa 10 ảnh.');
      event.target.value = '';
      return;
    }
    setSaveError('');
    setFiles(chosen);
  };

  const cities = [...new Set(items.map((venue) => venue.city))].sort();
  const filtered = items
    .filter(
      (venue) =>
        venue.category === category &&
        (!city || venue.city === city) &&
        (status === 'all' || venue.isActive === (status === 'active')) &&
        `${venue.name} ${venue.address} ${venue.district || ''}`
          .toLocaleLowerCase('vi-VN')
          .includes(search.toLocaleLowerCase('vi-VN')),
    )
    .sort((a, b) => (sort === 'rating' ? b.rating - a.rating : a.name.localeCompare(b.name, 'vi')));
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Địa điểm &amp; Spa</h1>
          <p className="text-xs text-[#66756B] mt-1">Quản lý địa điểm hiển thị trên ứng dụng MATXXA</p>
        </div>
        <button className={actionClass} onClick={() => void load()} disabled={loading || submitting}>
          <RefreshCw className="w-4 h-4" /> Tải lại
        </button>
      </div>
      {loadError && (
        <div role="alert" className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">
          Không tải được địa điểm: {loadError}. Đăng nhập admin và kiểm tra server đã chạy migration mới.
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
        <div ref={formRef} className="xl:col-span-2 bg-white border border-[#E5EBE5] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5EBE5] flex justify-between items-center">
            <h2 className="font-bold text-sm">{editingId ? 'Chỉnh sửa địa điểm' : 'Thêm địa điểm mới'}</h2>
            {editingId && (
              <button className={actionClass} onClick={reset} disabled={submitting}>
                Hủy sửa
              </button>
            )}
          </div>
          <form onSubmit={(event) => void save(event)} className="p-5 space-y-4">
            <fieldset disabled={submitting || locating} className="space-y-4 disabled:opacity-60">
              <Field label="Tên địa điểm *">
                <input required maxLength={200} className={inputClass} {...textField('name')} />
              </Field>
              <Field label="Danh mục">
                <select
                  className={inputClass}
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as Category }))}
                >
                  {CATEGORIES.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Mô tả">
                <textarea rows={3} maxLength={5000} className={inputClass} {...textField('description')} />
              </Field>
              <Field label="Địa chỉ *">
                <input required maxLength={1000} className={inputClass} {...textField('address')} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Thành phố *">
                  <input
                    required
                    maxLength={100}
                    placeholder="HN / HCM..."
                    className={inputClass}
                    {...textField('city')}
                  />
                </Field>
                <Field label="Quận / Huyện">
                  <input maxLength={100} className={inputClass} {...textField('district')} />
                </Field>
              </div>
              <button type="button" onClick={locate} className={`${actionClass} w-full`}>
                <Navigation className="w-4 h-4" />
                {locating ? 'Đang lấy vị trí...' : 'Lấy vị trí hiện tại'}
              </button>
              <p className="text-xs text-[#66756B]">Nhập tọa độ của địa điểm nếu bạn đang ở vị trí khác.</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Vĩ độ *">
                  <input
                    required
                    type="number"
                    min={-90}
                    max={90}
                    step="any"
                    className={inputClass}
                    {...textField('latitude')}
                  />
                </Field>
                <Field label="Kinh độ *">
                  <input
                    required
                    type="number"
                    min={-180}
                    max={180}
                    step="any"
                    className={inputClass}
                    {...textField('longitude')}
                  />
                </Field>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#66756B]">Ảnh địa điểm (tối đa 10 ảnh, 5 MB/ảnh)</p>
                <button type="button" onClick={() => fileRef.current?.click()} className={`${actionClass} w-full`}>
                  <Upload className="w-4 h-4" />
                  {files.length ? `${files.length} ảnh mới đã chọn` : 'Chọn ảnh từ máy tính'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={selectFiles}
                  className="hidden"
                />
                <div className="flex gap-2 flex-wrap">
                  {previews.map((url, index) => (
                    <div key={url} className="relative">
                      <img src={url} alt={`Ảnh mới ${index + 1}`} className="w-16 h-16 rounded-lg object-cover" />
                      <button
                        type="button"
                        title="Bỏ ảnh"
                        onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                        className="absolute top-0 right-0 bg-white rounded-full"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <Field label="URL ảnh đã lưu hoặc URL ảnh khác (mỗi dòng một URL)">
                  <textarea rows={3} placeholder="https://..." className={inputClass} {...textField('images')} />
                </Field>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-sm">Dịch vụ</h3>
                  <button
                    type="button"
                    className={actionClass}
                    disabled={form.services.length >= 100}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        services: [...current.services, { name: '', durationMinutes: 60, price: 0 }],
                      }))
                    }
                  >
                    <Plus className="w-3 h-3" />
                    Thêm
                  </button>
                </div>
                {form.services.length === 0 && <p className="text-xs text-[#66756B]">Chưa thêm dịch vụ.</p>}
                {form.services.map((service, index) => (
                  <div key={index} className="p-3 rounded-xl border border-[#E5EBE5] space-y-2">
                    <div className="flex gap-2">
                      <input
                        aria-label={`Tên dịch vụ ${index + 1}`}
                        required
                        maxLength={200}
                        placeholder="Tên dịch vụ"
                        value={service.name}
                        onChange={(event) => setService(index, { name: event.target.value })}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        title="Bỏ dịch vụ"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            services: current.services.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Thời lượng (phút)">
                        <input
                          required
                          type="number"
                          min={1}
                          max={1440}
                          value={service.durationMinutes}
                          onChange={(event) => setService(index, { durationMinutes: Number(event.target.value) })}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Giá (VND)">
                        <input
                          required
                          type="number"
                          min={0}
                          max={1000000000}
                          value={service.price}
                          onChange={(event) => setService(index, { price: Number(event.target.value) })}
                          className={inputClass}
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Giờ mở cửa</h3>
                {form.hours.map((hour, index) => (
                  <div key={hour.dayOfWeek} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="w-16">{DAYS[index].label}</span>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={!!hour.isClosed}
                        onChange={(event) => setHour(index, { isClosed: event.target.checked })}
                      />
                      Đóng cửa
                    </label>
                    {!hour.isClosed && (
                      <>
                        <input
                          aria-label={`Giờ mở ${DAYS[index].label}`}
                          type="time"
                          required
                          value={hour.openTime || ''}
                          onChange={(event) => setHour(index, { openTime: event.target.value })}
                          className="border rounded-lg p-1"
                        />
                        <span>–</span>
                        <input
                          aria-label={`Giờ đóng ${DAYS[index].label}`}
                          type="time"
                          required
                          value={hour.closeTime || ''}
                          onChange={(event) => setHour(index, { closeTime: event.target.value })}
                          className="border rounded-lg p-1"
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
                />
                Hiển thị địa điểm trên ứng dụng
              </label>
            </fieldset>
            {saveError && (
              <p role="alert" className="p-3 bg-red-50 text-red-700 rounded-xl text-xs">
                {saveError}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting || locating}
              className="w-full py-3 rounded-xl bg-[#2E7D4A] text-white font-bold text-sm disabled:opacity-50"
            >
              {submitting ? 'Đang lưu địa điểm...' : editingId ? 'Lưu thay đổi' : 'Thêm địa điểm'}
            </button>
          </form>
        </div>
        <div className="xl:col-span-3 space-y-4 min-w-0">
          <div className="bg-white border border-[#E5EBE5] rounded-2xl p-4 space-y-2">
            <h3 className="font-bold text-sm mb-3">Danh mục địa điểm</h3>
            {CATEGORIES.map((item) => (
              <button
                key={item.key}
                onClick={() => setCategory(item.key)}
                className={`w-full flex gap-3 items-center p-3 rounded-xl border text-left ${category === item.key ? 'border-[#2E7D4A] bg-[#EAF5EC]' : 'border-[#E5EBE5]'}`}
              >
                <item.icon className="w-5 h-5 text-[#2E7D4A]" />
                <span className="flex-1 text-sm font-semibold">{item.label}</span>
                <span className="text-xs text-[#66756B]">
                  {items.filter((venue) => venue.category === item.key).length}
                </span>
              </button>
            ))}
          </div>
          <div className="bg-white border border-[#E5EBE5] rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <input
                aria-label="Tìm địa điểm"
                placeholder="Tìm tên, địa chỉ..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={`${inputClass} flex-1 basis-40`}
              />
              <select
                aria-label="Lọc thành phố"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className={actionClass}
              >
                <option value="">Tất cả thành phố</option>
                {cities.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              <select
                aria-label="Lọc trạng thái"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className={actionClass}
              >
                <option value="all">Mọi trạng thái</option>
                <option value="active">Đang hiển thị</option>
                <option value="hidden">Đã ẩn</option>
              </select>
              <select
                aria-label="Sắp xếp"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className={actionClass}
              >
                <option value="name">Tên A–Z</option>
                <option value="rating">Đánh giá cao nhất</option>
              </select>
            </div>
            <p className="text-xs text-[#66756B]">{loading ? 'Đang tải địa điểm...' : `${filtered.length} địa điểm`}</p>
            {!loading && !loadError && !filtered.length && (
              <div className="py-10 text-center text-[#66756B]">
                <MapPin className="w-9 h-9 mx-auto mb-3" />
                <p className="text-sm">Chưa có địa điểm phù hợp.</p>
                <p className="text-xs mt-1">Thêm địa điểm hoặc thay đổi bộ lọc.</p>
              </div>
            )}
            {filtered.map((venue) => (
              <div key={venue.id} className="p-3 border border-[#E5EBE5] rounded-xl space-y-3">
                <button onClick={() => setSelected(venue)} className="w-full flex gap-3 text-left">
                  <div className="w-20 h-20 rounded-xl bg-[#F6F8F4] overflow-hidden shrink-0">
                    {venue.images[0] ? (
                      <img src={venue.images[0]} alt={venue.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-7 h-7 m-6 text-[#94A399]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm truncate">{venue.name}</h3>
                    <p className="text-xs text-[#66756B] mt-1">
                      {venue.address} · {venue.city}
                    </p>
                    <p className="text-xs mt-1 flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-500" />
                      {venue.reviewCount
                        ? `${venue.rating.toFixed(1)} (${venue.reviewCount} đánh giá)`
                        : 'Chưa có đánh giá'}
                    </p>
                    <p className={`text-xs mt-1 ${venue.isActive ? 'text-[#2E7D4A]' : 'text-[#94A399]'}`}>
                      {venue.isActive ? 'Đang hiển thị' : 'Đã ẩn'}
                    </p>
                  </div>
                </button>
                <div className="flex flex-wrap gap-2">
                  <button className={actionClass} disabled={submitting || busyId !== null} onClick={() => edit(venue)}>
                    <Pencil className="w-3 h-3" />
                    Sửa
                  </button>
                  <button
                    className={actionClass}
                    disabled={submitting || busyId !== null}
                    onClick={() => void toggle(venue)}
                  >
                    {venue.isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {venue.isActive ? 'Ẩn' : 'Hiển thị'}
                  </button>
                  <button
                    className={`${actionClass} text-red-600`}
                    disabled={submitting || busyId !== null}
                    onClick={() => void remove(venue)}
                  >
                    <Trash2 className="w-3 h-3" />
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={selected.name}
            onClick={(event) => event.stopPropagation()}
            className="bg-white rounded-2xl p-5 w-full max-w-xl max-h-[90dvh] overflow-y-auto space-y-4"
          >
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg">{selected.name}</h2>
              <button onClick={() => setSelected(null)} title="Đóng">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {selected.images.map((url, index) => (
                <img
                  key={`${url}-${index}`}
                  src={url}
                  alt={`Ảnh địa điểm ${index + 1}`}
                  className="w-48 h-36 rounded-xl object-cover"
                />
              ))}
            </div>
            <p className="text-sm whitespace-pre-wrap">{selected.description || 'Chưa có mô tả.'}</p>
            <p className="text-sm">
              {selected.address} · {selected.district} · {selected.city}
            </p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[#2E7D4A] inline-flex gap-2 items-center"
            >
              <Navigation className="w-4 h-4" />
              Mở vị trí trên bản đồ
            </a>
            <div>
              <h3 className="font-bold text-sm mb-2">Dịch vụ</h3>
              {selected.services.length ? (
                selected.services.map((service, index) => (
                  <p key={index} className="text-sm py-1">
                    {service.name} · {service.durationMinutes} phút · {money(service.price)}
                  </p>
                ))
              ) : (
                <p className="text-sm text-[#66756B]">Chưa có dịch vụ.</p>
              )}
            </div>
            <div>
              <h3 className="font-bold text-sm mb-2">Giờ mở cửa</h3>
              {DAYS.map((day) => {
                const hour = selected.hours.find((value) => value.dayOfWeek === day.value);
                return (
                  <p key={day.value} className="flex justify-between text-sm py-1">
                    <span>{day.label}</span>
                    <span>
                      {!hour ? 'Chưa cập nhật' : hour.isClosed ? 'Đóng cửa' : `${hour.openTime} – ${hour.closeTime}`}
                    </span>
                  </p>
                );
              })}
            </div>
            <p className="text-xs text-[#66756B]">
              {selected.reviewCount
                ? `${selected.rating.toFixed(1)} / 5 · ${selected.reviewCount} đánh giá`
                : 'Chưa có đánh giá.'}
            </p>
            <button className={actionClass} disabled={submitting} onClick={() => edit(selected)}>
              <Pencil className="w-4 h-4" />
              Chỉnh sửa địa điểm
            </button>
          </section>
        </div>
      )}
    </div>
  );
};
