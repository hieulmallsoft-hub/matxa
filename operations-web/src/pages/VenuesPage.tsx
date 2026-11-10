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
  BadgeCheck,
  Phone,
  Ticket,
  Clock,
  Copy,
  Store,
} from 'lucide-react';
import { request } from '../api/client';
import { useToast } from '../components/ui/ToastContainer';
import { AnimatePresence, motion } from 'framer-motion';
import { PageHeader } from '../components/common/PageHeader';
import { DetailDrawer } from '../components/common/DetailDrawer';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { LocationPicker } from '../components/LocationPicker';
import {
  AnimatedNumber,
  Badge,
  Button,
  Card,
  Checkbox,
  Empty,
  Field,
  FormError,
  FormGrid,
  FormSection,
  Input,
  Reveal,
  RevealItem,
  SearchBox,
  Select,
  SkeletonRows,
  Tabs,
  Textarea,
  controlClass,
} from '../components/ui/kit';

type Category = 'MASSAGE_SPA' | 'CONSULTATION';
type Offer = { id: string; code: string; title: string; discountLabel: string; endsAt: string };
type PromotionOption = { id: string; code: string; name: string; isActive: boolean; endsAt: string };
type Review = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  isHidden: boolean;
  reviewer: { displayName: string | null };
};
type ReviewPage = {
  items: Review[];
  total: number;
  summary: { average: number; count: number; distribution: Record<string, number> };
};
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
  phone: string | null;
  isVerified: boolean;
  promotionId: string | null;
  offer: Offer | null;
};
const CATEGORIES = [
  { key: 'MASSAGE_SPA' as Category, label: 'Massage / Spa', icon: Sparkles },
  { key: 'CONSULTATION' as Category, label: 'Phòng tham vấn', icon: Stethoscope },
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
  phone: '',
  isVerified: false,
  promotionId: '',
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
  phone: venue.phone ?? null,
  isVerified: Boolean(venue.isVerified),
  promotionId: venue.promotionId ?? null,
  offer: venue.offer ?? null,
  services: (venue.services || []).map((service) => ({ ...service, price: Number(service.price) })),
});

const dateText = (value: string) => new Date(value).toLocaleDateString('vi-VN');

/** Admin view of a venue's reviews: real names, hidden ones included, toggle visibility. */
function VenueReviews({ venueId, onRatingChange }: { venueId: string; onRatingChange: () => void }) {
  const { addToast } = useToast();
  const [page, setPage] = useState<ReviewPage | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setPage(await request<ReviewPage>(`/admin/venues/${venueId}/reviews?limit=50`));
      setError('');
    } catch (loadError) {
      setError(errorText(loadError));
    }
  }, [venueId]);
  useEffect(() => {
    void load();
  }, [load]);
  const toggle = async (review: Review) => {
    setBusy(review.id);
    try {
      await request(`/admin/venues/reviews/${review.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isHidden: !review.isHidden }),
      });
      await load();
      onRatingChange();
    } catch (toggleError) {
      addToast({ title: 'Không cập nhật được đánh giá', message: errorText(toggleError), type: 'error' });
    } finally {
      setBusy(null);
    }
  };
  if (error) return <p className="text-xs text-red-700">Không tải được đánh giá: {error}</p>;
  if (!page) return <p className="text-xs text-[#66756B]">Đang tải đánh giá...</p>;
  return (
    <div className="space-y-2">
      <p className="text-sm">
        <Star className="w-4 h-4 inline text-amber-500" /> {page.summary.average.toFixed(1)} / 5 ·{' '}
        {page.summary.count} đánh giá đang hiển thị
      </p>
      {!page.items.length && <p className="text-sm text-[#66756B]">Chưa có đánh giá.</p>}
      {page.items.map((review) => (
        <div
          key={review.id}
          className={`p-3 rounded-xl border border-[#E5EBE5] text-sm space-y-1 ${review.isHidden ? 'opacity-60' : ''}`}
        >
          <div className="flex justify-between gap-2">
            <span className="font-semibold">{review.reviewer.displayName || 'Khách hàng'}</span>
            <span className="text-amber-500">{'★'.repeat(review.rating)}</span>
          </div>
          {review.comment && <p className="whitespace-pre-wrap">{review.comment}</p>}
          <div className="flex justify-between items-center text-xs text-[#66756B]">
            <span>
              {dateText(review.createdAt)}
              {review.isHidden ? ' · Đã ẩn' : ''}
            </span>
            <button className={actionClass} disabled={busy !== null} onClick={() => void toggle(review)}>
              {review.isHidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              {review.isHidden ? 'Hiện lại' : 'Ẩn'}
            </button>
          </div>
        </div>
      ))}
    </div>
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
  const [promotions, setPromotions] = useState<PromotionOption[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Venue | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
    // The offer picker is optional; a failed load just leaves "Không có ưu đãi".
    void request<PromotionOption[]>('/admin/marketplace/promotions')
      .then(setPromotions)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const reset = () => {
    setFormOpen(false);
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
      phone: venue.phone || '',
      isVerified: venue.isVerified,
      promotionId: venue.promotionId || '',
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
    setFormOpen(true);
  };
  const openCreate = () => {
    reset();
    setFormOpen(true);
  };
  // Copies Monday's schedule to every day, the common case for spas.
  const applyMondayToAll = () =>
    setForm((current) => {
      const monday = current.hours.find((hour) => hour.dayOfWeek === 1);
      return monday
        ? { ...current, hours: current.hours.map((hour) => ({ ...hour, openTime: monday.openTime, closeTime: monday.closeTime, isClosed: monday.isClosed })) }
        : current;
    });
  const textField = (
    key: 'name' | 'description' | 'address' | 'city' | 'district' | 'latitude' | 'longitude' | 'images' | 'phone',
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
            phone: form.phone.trim() || null,
            promotionId: form.promotionId || null,
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
    setBusyId(venue.id);
    try {
      await request(`/admin/venues/${venue.id}`, { method: 'DELETE' });
      setItems((current) => current.filter((item) => item.id !== venue.id));
      setSelected(null);
      if (editingId === venue.id) reset();
      setConfirmDelete(null);
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
      setSaveError('Trang admin chưa chạy HTTPS nên trình duyệt không cho lấy vị trí hiện tại. Hãy tìm địa chỉ hoặc bấm lên bản đồ phía trên.');
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
  const counts = {
    total: items.length,
    active: items.filter((venue) => venue.isActive).length,
    hidden: items.filter((venue) => !venue.isActive).length,
    offers: items.filter((venue) => venue.offer).length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Địa điểm & Spa"
        subtitle="Quản lý spa, phòng tham vấn hiển thị trên ứng dụng Psyocore"
        actions={
          <>
            <Button icon={<RefreshCw className="w-4 h-4" />} onClick={() => void load()} loading={loading}>
              Tải lại
            </Button>
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
              Thêm địa điểm
            </Button>
          </>
        }
      />

      {loadError && (
        <div role="alert" className="p-3 rounded-xl bg-status-dangerBg border border-[#F8D2D0] text-[#B9403A] text-sm">
          Không tải được địa điểm: {loadError}
        </div>
      )}

      <Reveal className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Tổng địa điểm', value: counts.total, icon: <MapPin className="w-5 h-5" />, tone: 'bg-primary-soft text-primary' },
          { label: 'Đang hiển thị', value: counts.active, icon: <Eye className="w-5 h-5" />, tone: 'bg-status-successBg text-status-success' },
          { label: 'Đã ẩn', value: counts.hidden, icon: <EyeOff className="w-5 h-5" />, tone: 'bg-surface-muted text-content-secondary' },
          { label: 'Có ưu đãi', value: counts.offers, icon: <Ticket className="w-5 h-5" />, tone: 'bg-status-dangerBg text-status-danger' },
        ].map((stat) => (
          <RevealItem key={stat.label}>
            <div className="p-4 rounded-2xl bg-white border border-surface-border flex items-center gap-3">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.tone}`}>{stat.icon}</span>
              <span>
                <span className="block text-xs text-content-secondary">{stat.label}</span>
                <span className="block text-xl font-bold tabular-nums">
                  <AnimatedNumber value={stat.value} />
                </span>
              </span>
            </div>
          </RevealItem>
        ))}
      </Reveal>

      <Card bodyClassName="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            value={category}
            onChange={setCategory}
            items={CATEGORIES.map((item) => ({
              value: item.key,
              label: item.label,
              icon: <item.icon className="w-3.5 h-3.5" />,
              count: items.filter((venue) => venue.category === item.key).length,
            }))}
          />
          <SearchBox value={search} onChange={setSearch} placeholder="Tìm tên, địa chỉ..." className="flex-1 min-w-[200px]" />
          <div className="flex flex-wrap gap-2">
            <Select aria-label="Lọc thành phố" value={city} onChange={(event) => setCity(event.target.value)} className="py-2 text-xs">
              <option value="">Mọi thành phố</option>
              {cities.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
            <Select aria-label="Lọc trạng thái" value={status} onChange={(event) => setStatus(event.target.value)} className="py-2 text-xs">
              <option value="all">Mọi trạng thái</option>
              <option value="active">Đang hiển thị</option>
              <option value="hidden">Đã ẩn</option>
            </Select>
            <Select aria-label="Sắp xếp" value={sort} onChange={(event) => setSort(event.target.value)} className="py-2 text-xs">
              <option value="name">Tên A–Z</option>
              <option value="rating">Đánh giá cao nhất</option>
            </Select>
          </div>
        </div>

        {loading && !items.length ? (
          <SkeletonRows rows={3} />
        ) : !filtered.length ? (
          <Empty
            icon={<MapPin className="w-6 h-6" />}
            title={items.length ? 'Không có địa điểm khớp bộ lọc' : 'Chưa có địa điểm nào'}
            description={items.length ? 'Thử đổi danh mục, thành phố hoặc từ khóa.' : 'Thêm địa điểm đầu tiên để hiển thị trên ứng dụng.'}
            action={!items.length && <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Thêm địa điểm</Button>}
          />
        ) : (
          <motion.div layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence initial={false}>
              {filtered.map((venue, index) => (
                <motion.article
                  key={venue.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index, 8) * 0.03 } }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="group rounded-2xl border border-surface-border bg-white overflow-hidden hover:shadow-card-hover hover:border-[#D0DCD1] transition-[box-shadow,border-color]"
                >
                  <button onClick={() => setSelected(venue)} className="block w-full text-left">
                    <div className="relative h-36 bg-surface-subtle overflow-hidden">
                      {venue.images[0] ? (
                        <img src={venue.images[0]} alt={venue.name} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-content-tertiary absolute inset-0 m-auto" />
                      )}
                      {venue.offer && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-status-danger text-white text-[11px] font-bold shadow">{venue.offer.discountLabel}</span>
                      )}
                      <span className="absolute top-2 right-2">
                        <Badge tone={venue.isActive ? 'green' : 'gray'} dot>{venue.isActive ? 'Đang hiển thị' : 'Đã ẩn'}</Badge>
                      </span>
                    </div>
                    <div className="p-4 space-y-1.5">
                      <h3 className="font-bold text-sm flex items-center gap-1 min-w-0">
                        <span className="truncate">{venue.name}</span>
                        {venue.isVerified && <BadgeCheck className="w-4 h-4 text-primary shrink-0" />}
                      </h3>
                      <p className="text-xs text-content-secondary truncate">{venue.address} · {venue.city}</p>
                      <p className="text-xs flex items-center gap-1 text-content-secondary">
                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                        {venue.reviewCount ? <><b className="text-content-primary">{venue.rating.toFixed(1)}</b> ({venue.reviewCount} đánh giá)</> : 'Chưa có đánh giá'}
                        <span className="mx-1">·</span>
                        {venue.services.length} dịch vụ
                      </p>
                    </div>
                  </button>
                  <div className="px-4 pb-4 flex gap-2">
                    <Button size="sm" variant="soft" icon={<Pencil className="w-3.5 h-3.5" />} disabled={submitting || busyId !== null} onClick={() => edit(venue)}>
                      Sửa
                    </Button>
                    <Button size="sm" loading={busyId === venue.id} icon={venue.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} disabled={submitting || (busyId !== null && busyId !== venue.id)} onClick={() => void toggle(venue)}>
                      {venue.isActive ? 'Ẩn' : 'Hiện'}
                    </Button>
                    <Button size="sm" variant="ghost" className="ml-auto text-status-danger" aria-label={`Xóa ${venue.name}`} icon={<Trash2 className="w-3.5 h-3.5" />} disabled={submitting || busyId !== null} onClick={() => setConfirmDelete(venue)} />
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </Card>

      <DetailDrawer
        isOpen={formOpen}
        onClose={() => !submitting && reset()}
        title={editingId ? 'Chỉnh sửa địa điểm' : 'Thêm địa điểm mới'}
        subtitle="Các mục có dấu * là bắt buộc"
        width="xl"
        footer={
          <div className="w-full space-y-3">
            <FormError message={saveError} />
            <div className="flex justify-end gap-2">
              <Button onClick={reset} disabled={submitting}>Hủy</Button>
              <Button type="submit" form="venue-form" variant="primary" loading={submitting} disabled={locating}>
                {submitting ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Thêm địa điểm'}
              </Button>
            </div>
          </div>
        }
      >
        <form id="venue-form" onSubmit={(event) => void save(event)}>
          <fieldset disabled={submitting || locating} className="space-y-4">
            <FormSection title="Thông tin cơ bản" icon={<Store className="w-4 h-4" />}>
              <Field label="Tên địa điểm" required>
                <Input required maxLength={200} placeholder="VD: Mạc Thị - Spa cho Nam" {...textField('name')} />
              </Field>
              <Field label="Danh mục">
                <Select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as Category }))}>
                  {CATEGORIES.map((item) => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Mô tả" hint="Giới thiệu ngắn hiển thị trên app.">
                <Textarea maxLength={5000} {...textField('description')} />
              </Field>
            </FormSection>

            <FormSection title="Vị trí" description="Địa chỉ và tọa độ dùng để tính khoảng cách, chỉ đường" icon={<MapPin className="w-4 h-4" />}>
              <Field label="Địa chỉ" required>
                <Input required maxLength={1000} placeholder="Số nhà, đường, phường" {...textField('address')} />
              </Field>
              <FormGrid>
                <Field label="Thành phố" required>
                  <Input required maxLength={100} placeholder="HN, HCM..." {...textField('city')} />
                </Field>
                <Field label="Quận / Huyện">
                  <Input maxLength={100} {...textField('district')} />
                </Field>
                <Field label="Vĩ độ" required>
                  <Input required type="number" min={-90} max={90} step="any" placeholder="21.0285" {...textField('latitude')} />
                </Field>
                <Field label="Kinh độ" required>
                  <Input required type="number" min={-180} max={180} step="any" placeholder="105.8542" {...textField('longitude')} />
                </Field>
              </FormGrid>
              <LocationPicker
                latitude={form.latitude}
                longitude={form.longitude}
                onPick={(latitude, longitude, address) =>
                  setForm((current) => ({
                    ...current,
                    latitude: String(latitude),
                    longitude: String(longitude),
                    // A searched address fills an empty address field; a typed one is never overwritten.
                    address: address && !current.address.trim() ? address : current.address,
                  }))
                }
              />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon={<Navigation className="w-3.5 h-3.5" />} loading={locating} onClick={locate}>
                  {locating ? 'Đang lấy vị trí...' : 'Lấy vị trí hiện tại'}
                </Button>
                {form.latitude && form.longitude && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${form.latitude},${form.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    <MapPin className="w-3.5 h-3.5" /> Kiểm tra trên Google Maps
                  </a>
                )}
              </div>
            </FormSection>

            <FormSection title="Liên hệ & hiển thị trên app" icon={<Phone className="w-4 h-4" />}>
              <FormGrid>
                <Field label="Số điện thoại" hint='Để trống thì app ẩn nút "Gọi".'>
                  <Input type="tel" maxLength={20} placeholder="0901 234 567" pattern="\+?[0-9 .\-]{6,20}" {...textField('phone')} />
                </Field>
                <Field label="Ưu đãi (mã khuyến mãi)" hint="Chỉ hiện trên app khi mã đang bật và còn hạn.">
                  <Select value={form.promotionId} onChange={(event) => setForm((current) => ({ ...current, promotionId: event.target.value }))}>
                    <option value="">Không có ưu đãi</option>
                    {promotions.map((promotion) => (
                      <option key={promotion.id} value={promotion.id}>
                        {promotion.code} · {promotion.name}
                        {!promotion.isActive || new Date(promotion.endsAt) <= new Date() ? ' (đã tắt/hết hạn)' : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
              </FormGrid>
              <Checkbox label="Địa điểm đã xác minh" hint="Hiện dấu tích xanh cạnh tên." checked={form.isVerified} onChange={(isVerified) => setForm((current) => ({ ...current, isVerified }))} />
              <Checkbox label="Hiển thị trên ứng dụng" hint="Tắt để ẩn tạm thời mà không xóa." checked={form.isActive} onChange={(isActive) => setForm((current) => ({ ...current, isActive }))} />
            </FormSection>

            <FormSection title="Ảnh" description="Tối đa 10 ảnh, JPEG/PNG/WebP, 5 MB mỗi ảnh. Ảnh đầu tiên là ảnh bìa." icon={<ImageIcon className="w-4 h-4" />}>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full rounded-2xl border-2 border-dashed border-[#D0DCD1] bg-surface-subtle hover:bg-primary-light hover:border-primary/40 transition-colors py-6 flex flex-col items-center gap-1.5 text-content-secondary"
              >
                <Upload className="w-6 h-6 text-primary" />
                <span className="text-sm font-semibold text-content-primary">{files.length ? `${files.length} ảnh mới đã chọn` : 'Chọn ảnh từ máy tính'}</span>
                <span className="text-[11px]">Ảnh được tải lên khi bấm Lưu</span>
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={selectFiles} className="hidden" />
              {previews.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {previews.map((url, index) => (
                    <motion.div key={url} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative">
                      <img src={url} alt={`Ảnh mới ${index + 1}`} className="w-20 h-20 rounded-xl object-cover border border-surface-border" />
                      <button
                        type="button"
                        aria-label="Bỏ ảnh"
                        onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                        className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-white shadow border border-surface-border flex items-center justify-center hover:text-status-danger"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
              <Field label="URL ảnh đã lưu / ảnh khác" hint="Mỗi dòng một URL bắt đầu bằng http:// hoặc https://">
                <Textarea placeholder="https://..." className="font-mono text-xs" {...textField('images')} />
              </Field>
            </FormSection>

            <FormSection title={`Dịch vụ (${form.services.length})`} description="Hiển thị ở mục Dịch vụ trên app" icon={<Sparkles className="w-4 h-4" />}>
              <AnimatePresence initial={false}>
                {form.services.map((service, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_110px_140px_auto] gap-2 items-end p-3 rounded-xl bg-surface-subtle border border-surface-border">
                      <Field label={`Tên dịch vụ ${index + 1}`} className="col-span-1">
                        <Input required maxLength={200} placeholder="Massage toàn thân" value={service.name} onChange={(event) => setService(index, { name: event.target.value })} className="bg-white" />
                      </Field>
                      <Field label="Phút" className="order-3 sm:order-none">
                        <Input required type="number" min={1} max={1440} value={service.durationMinutes} onChange={(event) => setService(index, { durationMinutes: Number(event.target.value) })} className="bg-white" />
                      </Field>
                      <Field label="Giá (VND)" className="order-4 sm:order-none">
                        <Input required type="number" min={0} max={1000000000} step={1000} value={service.price} onChange={(event) => setService(index, { price: Number(event.target.value) })} className="bg-white" />
                      </Field>
                      <Button
                        variant="ghost"
                        aria-label={`Bỏ dịch vụ ${index + 1}`}
                        className="text-status-danger mb-0.5"
                        icon={<X className="w-4 h-4" />}
                        onClick={() => setForm((current) => ({ ...current, services: current.services.filter((_, i) => i !== index) }))}
                      />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              <Button
                size="sm"
                variant="soft"
                icon={<Plus className="w-3.5 h-3.5" />}
                disabled={form.services.length >= 100}
                onClick={() => setForm((current) => ({ ...current, services: [...current.services, { name: '', durationMinutes: 60, price: 0 }] }))}
              >
                Thêm dịch vụ
              </Button>
            </FormSection>

            <FormSection title="Giờ mở cửa" icon={<Clock className="w-4 h-4" />}>
              <div className="divide-y divide-surface-borderSubtle rounded-xl border border-surface-border">
                {form.hours.map((hour, index) => (
                  <div key={hour.dayOfWeek} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <span className="w-20 text-sm font-medium">{DAYS[index].label}</span>
                    <label className="inline-flex items-center gap-2 text-xs text-content-secondary">
                      <input type="checkbox" checked={!hour.isClosed} onChange={(event) => setHour(index, { isClosed: !event.target.checked })} className="accent-[#2E7D4A] w-4 h-4" />
                      Mở cửa
                    </label>
                    {hour.isClosed ? (
                      <span className="text-xs font-semibold text-status-danger ml-auto">Đóng cửa</span>
                    ) : (
                      <span className="ml-auto inline-flex items-center gap-2">
                        <input aria-label={`Giờ mở ${DAYS[index].label}`} type="time" required value={hour.openTime || ''} onChange={(event) => setHour(index, { openTime: event.target.value })} className={`${controlClass} w-auto py-1.5`} />
                        <span className="text-content-tertiary">–</span>
                        <input aria-label={`Giờ đóng ${DAYS[index].label}`} type="time" required value={hour.closeTime || ''} onChange={(event) => setHour(index, { closeTime: event.target.value })} className={`${controlClass} w-auto py-1.5`} />
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <Button size="sm" variant="ghost" icon={<Copy className="w-3.5 h-3.5" />} onClick={applyMondayToAll}>
                Áp dụng giờ Thứ Hai cho cả tuần
              </Button>
            </FormSection>
          </fieldset>
        </form>
      </DetailDrawer>

      <DetailDrawer
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        subtitle={selected ? `${selected.address} · ${selected.city}` : ''}
        badge={selected && <Badge tone={selected.isActive ? 'green' : 'gray'} dot>{selected.isActive ? 'Đang hiển thị' : 'Đã ẩn'}</Badge>}
        width="lg"
        footer={
          selected && (
            <Button variant="primary" icon={<Pencil className="w-4 h-4" />} disabled={submitting} onClick={() => edit(selected)}>
              Chỉnh sửa địa điểm
            </Button>
          )
        }
      >
        {selected && (
          <div className="space-y-5">
            {selected.images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 snap-x">
                {selected.images.map((url, index) => (
                  <img key={`${url}-${index}`} src={url} alt={`Ảnh ${index + 1}`} className="w-56 h-40 rounded-xl object-cover snap-start shrink-0" />
                ))}
              </div>
            )}
            <p className="text-sm whitespace-pre-wrap text-content-secondary">{selected.description || 'Chưa có mô tả.'}</p>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <p className="inline-flex items-center gap-2"><Phone className="w-4 h-4 text-primary" />{selected.phone || 'Chưa có số điện thoại'}</p>
              <a href={`https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline">
                <Navigation className="w-4 h-4" /> Mở trên bản đồ
              </a>
            </div>
            {selected.offer ? (
              <div className="p-3 rounded-xl bg-status-dangerBg border border-[#F8D2D0] text-sm flex items-center gap-2">
                <Ticket className="w-4 h-4 text-status-danger" />
                {selected.offer.title} ({selected.offer.code}) · đến {dateText(selected.offer.endsAt)}
              </div>
            ) : (
              selected.promotionId && <p className="text-xs text-[#A86A0C]">Mã ưu đãi đã gắn nhưng đang tắt hoặc hết hạn nên app không hiện.</p>
            )}
            <section>
              <h3 className="font-bold text-sm mb-2">Dịch vụ</h3>
              {selected.services.length ? (
                <ul className="divide-y divide-surface-borderSubtle rounded-xl border border-surface-border">
                  {selected.services.map((service, index) => (
                    <li key={index} className="flex justify-between gap-3 px-3 py-2 text-sm">
                      <span>{service.name}</span>
                      <span className="text-content-secondary whitespace-nowrap">{service.durationMinutes} phút · <b className="text-content-primary">{money(service.price)}</b></span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-content-secondary">Chưa có dịch vụ.</p>
              )}
            </section>
            <section>
              <h3 className="font-bold text-sm mb-2">Giờ mở cửa</h3>
              <ul className="rounded-xl border border-surface-border divide-y divide-surface-borderSubtle">
                {DAYS.map((day) => {
                  const hour = selected.hours.find((value) => value.dayOfWeek === day.value);
                  return (
                    <li key={day.value} className="flex justify-between px-3 py-1.5 text-sm">
                      <span>{day.label}</span>
                      <span className={hour?.isClosed ? 'text-status-danger font-medium' : 'text-content-secondary'}>
                        {!hour ? 'Chưa cập nhật' : hour.isClosed ? 'Đóng cửa' : `${hour.openTime} – ${hour.closeTime}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
            <section>
              <h3 className="font-bold text-sm mb-2">Đánh giá của khách</h3>
              <VenueReviews venueId={selected.id} onRatingChange={() => void load()} />
            </section>
          </div>
        )}
      </DetailDrawer>

      <ConfirmDialog
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && void remove(confirmDelete)}
        isLoading={busyId !== null}
        title="Xóa địa điểm?"
        message={`“${confirmDelete?.name ?? ''}” sẽ bị gỡ khỏi admin và ứng dụng. Muốn ẩn tạm thời thì dùng nút Ẩn.`}
        confirmText="Xóa địa điểm"
      />
    </div>
  );
};
