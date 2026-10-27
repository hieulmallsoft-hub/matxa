import React, { useEffect, useRef, useState } from 'react';
import { request } from '../api/client';
import {
  MapPin,
  Star,
  Clock,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Tag,
  Navigation,
  X,
  Plus,
  Upload,
  Image as ImageIcon,
  Share2,
  ChevronLeft,
  ExternalLink,
  Stethoscope,
  BookOpen,
  Sparkles,
} from 'lucide-react';

/* ────── Types ────── */
type Venue = {
  id: string;
  name: string;
  address: string;
  city: string;
  district?: string;
  rating: number;
  reviewCount?: number;
  images?: string[];
  services?: { name: string; durationMinutes?: number; price?: number }[];
  hours?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  distance?: number;
  discount?: number;
};

/* ────── Mock fallback ────── */
const FALLBACK: Venue[] = [
  {
    id: 'v-1',
    name: 'Mạc Thị - Spa cho Nam',
    address: '123 Đường Nguyễn Trãi, Quận 1, HCMC',
    city: 'TP. Hồ Chí Minh',
    district: 'Quận 1',
    rating: 4.4,
    reviewCount: 8565,
    images: [
      'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=800&auto=format&fit=crop&q=80',
    ],
    services: [
      { name: 'Massage toàn thân', durationMinutes: 60, price: 350000 },
      { name: 'Chăm sóc da mặt', durationMinutes: 45, price: 250000 },
      { name: 'Bấm huyệt thư giãn', durationMinutes: 30, price: 180000 },
    ],
    hours: '09:00-22:00',
    description: 'Không gian thư giãn cao cấp dành riêng cho phái mạnh với đội ngũ kỹ thuật viên chuyên nghiệp.',
    distance: 1.7,
    discount: 40,
  },
  {
    id: 'v-2',
    name: 'Zen Wellness Spa',
    address: '45 Lê Lợi, Quận 3, HCMC',
    city: 'TP. Hồ Chí Minh',
    district: 'Quận 3',
    rating: 4.8,
    reviewCount: 3210,
    images: [
      'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?w=800&auto=format&fit=crop&q=80',
    ],
    services: [
      { name: 'Shiatsu Nhật Bản', durationMinutes: 90, price: 650000 },
      { name: 'Aromatherapy', durationMinutes: 60, price: 420000 },
    ],
    hours: '10:00-21:00',
    distance: 2.3,
    discount: 30,
  },
  {
    id: 'v-3',
    name: 'Lotus Healing Center',
    address: '88 Trần Hưng Đạo, Hà Nội',
    city: 'Hà Nội',
    district: 'Hoàn Kiếm',
    rating: 4.6,
    reviewCount: 1890,
    images: [
      'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop&q=80',
    ],
    services: [
      { name: 'Massage Cổ Vai Gáy', durationMinutes: 45, price: 280000 },
      { name: 'Yoga & Thiền định', durationMinutes: 60, price: 200000 },
    ],
    hours: '08:00-22:00',
    distance: 1.2,
  },
  {
    id: 'v-4',
    name: 'Royal Spa & Beauty',
    address: '12 Hoàng Diệu, Đà Nẵng',
    city: 'Đà Nẵng',
    rating: 4.3,
    reviewCount: 756,
    images: [
      'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=800&auto=format&fit=crop&q=80',
    ],
    services: [
      { name: 'Đá nóng trị liệu', durationMinutes: 75, price: 480000 },
    ],
    hours: '09:00-20:00',
    distance: 3.1,
    discount: 10,
  },
];

const MOCK_REVIEWS = [
  { id: 'r-1', user: '············g', date: '2 ngày trước', rating: 5, content: 'Kỹ thuật tốt, thái độ nhẹ nhàng. Mình rất hài lòng và sẽ book lại lần sau.' },
  { id: 'r-2', user: '············g', date: '2 ngày trước', rating: 5, content: 'Kỹ thuật tốt, thái độ nhẹ nhàng. Mình rất hài lòng và sẽ book lại lần sau.' },
];

const DAYS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];

const money = (v: number) => new Intl.NumberFormat('vi-VN').format(v) + 'đ';

const initialForm = {
  name: '', description: '', address: '', city: 'HN', district: '',
  latitude: '', longitude: '', images: '', services: '', hours: '09:00-22:00',
};

/* ────── Sub-components ────── */

function StarRow({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5';
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${cls} ${s <= Math.round(rating) ? 'fill-[#F2A93B] text-[#F2A93B]' : 'text-[#E5EBE5]'}`}
        />
      ))}
    </span>
  );
}

function DiscountBadge({ pct }: { pct: number }) {
  return (
    <span className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-[#E04F5F] text-white text-[11px] font-bold shadow-sm">
      -{pct}%
    </span>
  );
}

/* ── Venue Card (list item) ── */
function VenueCard({ venue, onClick }: { venue: Venue; onClick: () => void }) {
  const thumb = venue.images?.[0];
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white border border-[#F1F5EF] hover:border-[#2E7D4A]/30 hover:shadow-md transition-all text-left group"
    >
      {/* Thumbnail */}
      <div className="relative w-[72px] h-[72px] rounded-xl overflow-hidden flex-shrink-0 bg-[#F6F8F4]">
        {thumb ? (
          <img src={thumb} alt={venue.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-[#C4D2C6]" />
          </div>
        )}
        {venue.discount && <DiscountBadge pct={venue.discount} />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm text-[#1C2B20] leading-snug truncate">{venue.name}</p>
        <div className="flex items-center gap-1 mt-1">
          <Star className="w-3.5 h-3.5 fill-[#F2A93B] text-[#F2A93B]" />
          <span className="text-xs font-semibold text-[#1C2B20]">{venue.rating.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-1 mt-1 text-[11px] text-[#66756B]">
          <MapPin className="w-3 h-3" />
          <span>{venue.distance ? `${venue.distance} km` : venue.city}</span>
        </div>
      </div>
    </button>
  );
}

/* ── Venue Detail Modal ── */
function VenueDetailModal({ venue, onClose }: { venue: Venue; onClose: () => void }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [showPromo, setShowPromo] = useState(false);
  const images = venue.images?.length ? venue.images : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1C2B20]/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-sm bg-[#FAFAF8] rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ fontFamily: 'inherit' }}
      >
        {/* ── Image carousel ── */}
        <div className="relative h-52 flex-shrink-0 bg-[#E5EBE5]">
          {images[imgIdx] ? (
            <img src={images[imgIdx]} alt={venue.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#F1F5EF]">
              <ImageIcon className="w-12 h-12 text-[#C4D2C6]" />
            </div>
          )}
          {/* Nav buttons */}
          <button onClick={onClose} className="absolute top-3 left-3 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/50 transition-colors">
            <Share2 className="w-4 h-4" />
          </button>
          {/* Image counter */}
          {images.length > 1 && (
            <div className="absolute bottom-2 right-3 px-2 py-0.5 rounded-full bg-black/50 text-white text-[10px] font-semibold">
              {imgIdx + 1}/{images.length}
            </div>
          )}
          {/* Dots */}
          {images.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {images.map((_, i) => (
                <button key={i} onClick={() => setImgIdx(i)} className={`w-1.5 h-1.5 rounded-full transition-all ${i === imgIdx ? 'bg-white w-4' : 'bg-white/50'}`} />
              ))}
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          {/* Header info */}
          <div className="px-5 pt-4 pb-3 border-b border-[#F1F5EF]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="font-bold text-base text-[#1C2B20]">{venue.name}</h2>
                  <CheckCircle2 className="w-4 h-4 text-[#2E9B62] flex-shrink-0" />
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-[#66756B]">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {venue.distance ? `${venue.distance} km` : venue.city}
                  </span>
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3 fill-[#F2A93B] text-[#F2A93B]" />
                    <span className="font-semibold text-[#1C2B20]">{venue.rating.toFixed(1)}</span>
                    {venue.reviewCount && <span>({venue.reviewCount.toLocaleString('vi-VN')} đánh giá)</span>}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 pt-4 space-y-5 pb-6">
            {/* Dịch vụ */}
            <div>
              <h3 className="font-bold text-sm text-[#1C2B20] mb-3">Dịch vụ</h3>
              <div className="space-y-2">
                {(venue.services ?? [{ name: 'Massage toàn thân' }, { name: 'Massage toàn thân' }, { name: 'Massage toàn thân' }]).map((svc, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#1C2B20] flex-shrink-0" />
                    <span className="text-sm text-[#1C2B20]">{svc.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Promo banner */}
            {venue.discount && !showPromo && (
              <div className="rounded-2xl border border-[#E5EBE5] bg-[#F6F8F4] p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#FEF0C7] flex items-center justify-center flex-shrink-0">
                  <Tag className="w-4 h-4 text-[#D97706]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#1C2B20]">Giảm {venue.discount}% dịch vụ massage</p>
                  <p className="text-[11px] text-[#66756B]">Có hiệu lực đến 30 tháng 11</p>
                </div>
                <button
                  onClick={() => setShowPromo(true)}
                  className="text-xs font-semibold text-[#2E7D4A] hover:underline flex-shrink-0"
                >
                  Xem ưu đãi
                </button>
              </div>
            )}

            {/* Promo detail */}
            {showPromo && venue.discount && (
              <div className="rounded-2xl border border-[#E5EBE5] overflow-hidden">
                <div className="p-4 bg-[#EEF4FF]">
                  <span className="font-bold text-base text-[#1C2B20]">Giảm {venue.discount}%</span>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <p className="font-semibold text-sm text-[#1C2B20] mb-2">Thông tin</p>
                    <div className="p-3 rounded-xl bg-[#F6F8F4] text-xs text-[#66756B]">
                      Giảm {venue.discount}% cho tất cả dịch vụ massage khi đặt lịch qua app MATXXA. Áp dụng đến 30/11/2024.
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-[#1C2B20] mb-2">Điều khoản và điều kiện</p>
                    <div className="p-3 rounded-xl bg-[#F6F8F4] text-xs text-[#66756B]">
                      Không áp dụng cùng các ưu đãi khác. Mỗi tài khoản chỉ sử dụng 1 lần.
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-start gap-2">
                    <span className="text-[#EF4444] text-sm mt-0.5">ℹ</span>
                    <div>
                      <p className="text-xs font-semibold text-[#EF4444]">Lưu ý</p>
                      <p className="text-xs text-[#EF4444]/80 mt-0.5">Ưu đãi chỉ áp dụng cho lịch đặt từ 09:00 - 17:00 các ngày trong tuần.</p>
                    </div>
                  </div>
                  <button onClick={() => setShowPromo(false)} className="w-full py-2 text-xs font-semibold text-[#66756B] hover:text-[#1C2B20] border border-[#E5EBE5] rounded-xl">Đóng</button>
                </div>
              </div>
            )}

            {/* Địa điểm */}
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-[#66756B] mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#1C2B20]">{venue.address}</p>
              </div>
              <button className="p-1.5 rounded-xl hover:bg-[#F6F8F4] text-[#66756B] transition-colors">
                <Navigation className="w-4 h-4" />
              </button>
            </div>

            {/* Giờ mở cửa */}
            <div className="border border-[#E5EBE5] rounded-2xl overflow-hidden">
              <button
                onClick={() => setHoursOpen(!hoursOpen)}
                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[#F6F8F4] transition-colors"
              >
                <Clock className="w-4 h-4 text-[#66756B]" />
                <div className="flex-1">
                  <span className="text-sm text-[#1C2B20]">Giờ mở cửa</span>
                  {!hoursOpen && (
                    <span className="text-xs text-[#66756B] ml-2">Thứ Hai - Chủ Nhật {venue.hours ?? '09:00 - 22:00'}</span>
                  )}
                </div>
                {hoursOpen ? <ChevronUp className="w-4 h-4 text-[#66756B]" /> : <ChevronDown className="w-4 h-4 text-[#66756B]" />}
              </button>
              {hoursOpen && (
                <div className="px-4 pb-4 space-y-1.5 border-t border-[#F1F5EF] pt-3">
                  {DAYS.map((day, i) => {
                    const isClosed = i === 6;
                    return (
                      <div key={day} className="flex items-center justify-between text-sm">
                        <span className="text-[#66756B]">{day}</span>
                        {isClosed ? (
                          <span className="text-[#EF4444] font-semibold">Đóng cửa</span>
                        ) : (
                          <span className="text-[#1C2B20]">{venue.hours ?? '09:00 - 22:00'}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Đánh giá */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-sm text-[#1C2B20]">Đánh giá</h3>
                <button className="text-xs text-[#2E7D4A] font-semibold hover:underline">Xem tất cả</button>
              </div>
              <div className="flex items-start gap-4 mb-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-[#1C2B20]">{venue.rating.toFixed(1)}</div>
                  <StarRow rating={venue.rating} size="sm" />
                  <div className="text-[10px] text-[#66756B] mt-1">{venue.reviewCount ?? 24} đánh giá</div>
                </div>
                <div className="flex-1 space-y-1">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const pct = star === 5 ? 78 : star === 4 ? 15 : star === 3 ? 4 : star === 2 ? 2 : 1;
                    return (
                      <div key={star} className="flex items-center gap-2">
                        <span className="text-[10px] text-[#66756B] w-2">{star}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-[#F1F5EF] overflow-hidden">
                          <div className="h-full rounded-full bg-[#1C2B20]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-3">
                {MOCK_REVIEWS.map((r) => (
                  <div key={r.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#E5EBE5] flex-shrink-0" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#66756B]">{r.user}</span>
                        <StarRow rating={r.rating} size="sm" />
                      </div>
                      <p className="text-xs text-[#66756B] mt-0.5">{r.date}</p>
                      <p className="text-sm text-[#1C2B20] mt-1 leading-relaxed">{r.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────── Main Page ────── */
export const VenuesPage: React.FC = () => {
  const [items, setItems] = useState<Venue[]>([]);
  const [form, setForm] = useState(initialForm);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [selected, setSelected] = useState<Venue | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filterCategory, setFilterCategory] = useState<'massage' | 'consult' | 'course'>('massage');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () =>
    void request<Venue[]>('/admin/venues')
      .then((data) => setItems(data?.length ? data : FALLBACK))
      .catch(() => setItems(FALLBACK));

  useEffect(load, []);

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value }),
  });

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const [openTime, closeTime] = form.hours.split('-');
      const uploaded = await Promise.all(
        imageFiles.map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            }),
        ),
      );
      await request('/admin/venues', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          images: [...form.images.split(',').map((v) => v.trim()).filter(Boolean), ...uploaded],
          services: form.services
            .split(',')
            .map((n) => n.trim())
            .filter(Boolean)
            .map((name) => ({ name, durationMinutes: 60, price: 0 })),
          hours: [{ dayOfWeek: 1, openTime, closeTime }],
        }),
      });
      setImageFiles([]);
      setForm(initialForm);
      load();
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const CATEGORIES = [
    { key: 'massage', label: 'Massage/spa', sub: 'Thư giãn·Tái tạo', icon: <Sparkles className="w-5 h-5" /> },
    { key: 'consult', label: 'Phòng tham vấn', sub: 'Lắng nghe·Đồng hành', icon: <Stethoscope className="w-5 h-5" /> },
    { key: 'course', label: 'Khóa học', sub: 'Học hỏi·Phát triển', icon: <BookOpen className="w-5 h-5" /> },
  ] as const;

  return (
    <div className="space-y-6">
      {/* ── Page Title ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1C2B20]">Địa điểm &amp; Spa</h1>
          <p className="text-xs text-[#66756B] mt-0.5">Quản lý và thêm mới địa điểm trên hệ thống MATXXA</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#66756B]">
          <span className="px-2.5 py-1 rounded-full bg-[#EAF5EC] text-[#2E7D4A] font-semibold">{items.length} địa điểm</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── LEFT: Add Venue Form ── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-[#E5EBE5] rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-[#E5EBE5] bg-[#FAFCF9]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#EAF5EC] flex items-center justify-center">
                  <Plus className="w-4 h-4 text-[#2E7D4A]" />
                </div>
                <div>
                  <h2 className="font-bold text-sm text-[#1C2B20]">Thêm địa điểm mới</h2>
                  <p className="text-[11px] text-[#66756B]">Điền thông tin spa / trung tâm dưới đây</p>
                </div>
              </div>
            </div>

            <form onSubmit={create} className="p-5 space-y-3">
              {/* Row 1: name + description */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-[#66756B] mb-1">Tên địa điểm *</label>
                  <input
                    required
                    placeholder="Mạc Thị Spa..."
                    {...field('name')}
                    className="w-full px-3 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-sm focus:outline-none focus:border-[#2E7D4A] focus:ring-2 focus:ring-[#2E7D4A]/10 transition-all placeholder:text-[#C4D2C6]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#66756B] mb-1">Mô tả</label>
                  <input
                    placeholder="Không gian thư giãn..."
                    {...field('description')}
                    className="w-full px-3 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-sm focus:outline-none focus:border-[#2E7D4A] focus:ring-2 focus:ring-[#2E7D4A]/10 transition-all placeholder:text-[#C4D2C6]"
                  />
                </div>
              </div>

              {/* Row 2: address + city */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-[#66756B] mb-1">Địa chỉ *</label>
                  <input
                    required
                    placeholder="123 Nguyễn Trãi..."
                    {...field('address')}
                    className="w-full px-3 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-sm focus:outline-none focus:border-[#2E7D4A] focus:ring-2 focus:ring-[#2E7D4A]/10 transition-all placeholder:text-[#C4D2C6]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#66756B] mb-1">Thành phố</label>
                  <input
                    placeholder="HN / HCM..."
                    {...field('city')}
                    className="w-full px-3 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-sm focus:outline-none focus:border-[#2E7D4A] focus:ring-2 focus:ring-[#2E7D4A]/10 transition-all placeholder:text-[#C4D2C6]"
                  />
                </div>
              </div>

              {/* Row 3: district + hours */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-[#66756B] mb-1">Quận / Huyện</label>
                  <input
                    placeholder="Quận 1..."
                    {...field('district')}
                    className="w-full px-3 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-sm focus:outline-none focus:border-[#2E7D4A] focus:ring-2 focus:ring-[#2E7D4A]/10 transition-all placeholder:text-[#C4D2C6]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#66756B] mb-1">Giờ mở cửa</label>
                  <input
                    placeholder="09:00-22:00"
                    {...field('hours')}
                    className="w-full px-3 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-sm focus:outline-none focus:border-[#2E7D4A] focus:ring-2 focus:ring-[#2E7D4A]/10 transition-all placeholder:text-[#C4D2C6]"
                  />
                </div>
              </div>

              {/* Services */}
              <div>
                <label className="block text-[11px] font-semibold text-[#66756B] mb-1">Dịch vụ (cách nhau bằng dấu phẩy)</label>
                <input
                  placeholder="Massage toàn thân, Shiatsu, Chăm sóc da..."
                  {...field('services')}
                  className="w-full px-3 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-sm focus:outline-none focus:border-[#2E7D4A] focus:ring-2 focus:ring-[#2E7D4A]/10 transition-all placeholder:text-[#C4D2C6]"
                />
              </div>

              {/* Image upload */}
              <div>
                <label className="block text-[11px] font-semibold text-[#66756B] mb-1">Ảnh địa điểm</label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#F6F8F4] border border-dashed border-[#C6E2CE] cursor-pointer hover:border-[#2E7D4A] hover:bg-[#EAF5EC] transition-all"
                >
                  <Upload className="w-4 h-4 text-[#66756B] flex-shrink-0" />
                  <span className="text-sm text-[#66756B]">
                    {imageFiles.length ? `${imageFiles.length} ảnh đã chọn` : 'Chọn ảnh từ máy tính'}
                  </span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => setImageFiles(Array.from(e.target.files ?? []))}
                  />
                </div>
              </div>

              {/* URL images */}
              <div>
                <label className="block text-[11px] font-semibold text-[#66756B] mb-1">Hoặc dán URL ảnh</label>
                <input
                  placeholder="https://..."
                  {...field('images')}
                  className="w-full px-3 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-sm focus:outline-none focus:border-[#2E7D4A] focus:ring-2 focus:ring-[#2E7D4A]/10 transition-all placeholder:text-[#C4D2C6]"
                />
              </div>

              {/* Lat + Long */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-[#66756B] mb-1">Vĩ độ (Latitude) *</label>
                  <input
                    required
                    placeholder="10.7769"
                    {...field('latitude')}
                    className="w-full px-3 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-sm font-mono focus:outline-none focus:border-[#2E7D4A] focus:ring-2 focus:ring-[#2E7D4A]/10 transition-all placeholder:text-[#C4D2C6]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#66756B] mb-1">Kinh độ (Longitude) *</label>
                  <input
                    required
                    placeholder="106.7009"
                    {...field('longitude')}
                    className="w-full px-3 py-2 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-sm font-mono focus:outline-none focus:border-[#2E7D4A] focus:ring-2 focus:ring-[#2E7D4A]/10 transition-all placeholder:text-[#C4D2C6]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-1 py-3 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white font-bold text-sm transition-colors shadow-sm disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {submitting ? 'Đang lưu...' : 'Thêm địa điểm'}
              </button>
            </form>
          </div>
        </div>

        {/* ── RIGHT: Venues List ── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Category filter tabs (from Figma) */}
          <div className="bg-white border border-[#E5EBE5] rounded-2xl p-4 shadow-sm">
            <h3 className="font-bold text-sm text-[#1C2B20] mb-3">Danh mục địa điểm</h3>
            <div className="space-y-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setFilterCategory(cat.key)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left ${
                    filterCategory === cat.key
                      ? 'border-[#2E7D4A] bg-[#EAF5EC]'
                      : 'border-[#F1F5EF] bg-[#FAFCF9] hover:border-[#C6E2CE] hover:bg-[#F6F8F4]'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${filterCategory === cat.key ? 'bg-[#2E7D4A] text-white' : 'bg-[#E5EBE5] text-[#66756B]'}`}>
                    {cat.icon}
                  </div>
                  <div className="flex-1">
                    <p className={`font-semibold text-sm ${filterCategory === cat.key ? 'text-[#2E7D4A]' : 'text-[#1C2B20]'}`}>{cat.label}</p>
                    <p className="text-xs text-[#94A399]">{cat.sub}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 rotate-[-90deg] transition-colors ${filterCategory === cat.key ? 'text-[#2E7D4A]' : 'text-[#C4D2C6]'}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Venue List */}
          <div className="bg-white border border-[#E5EBE5] rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#F1F5EF] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#1C2B20]">
                  {CATEGORIES.find((c) => c.key === filterCategory)?.label}
                </h3>
                <p className="text-[11px] text-[#94A399] mt-0.5">{items.length} địa điểm được tìm thấy</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E5EBE5] text-xs font-semibold text-[#66756B] hover:bg-[#F6F8F4] transition-colors">
                  <MapPin className="w-3 h-3" /> Địa điểm <ChevronDown className="w-3 h-3" />
                </button>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E5EBE5] text-xs font-semibold text-[#66756B] hover:bg-[#F6F8F4] transition-colors">
                  <Star className="w-3 h-3" /> Đánh giá <ChevronDown className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="p-3 space-y-2 max-h-[480px] overflow-y-auto">
              {items.map((venue) => (
                <VenueCard key={venue.id} venue={venue} onClick={() => setSelected(venue)} />
              ))}
              {!items.length && (
                <div className="py-12 text-center">
                  <MapPin className="w-10 h-10 mx-auto text-[#C4D2C6] mb-3" />
                  <p className="text-sm font-medium text-[#66756B]">Chưa có địa điểm nào</p>
                  <p className="text-xs text-[#94A399] mt-1">Thêm địa điểm đầu tiên từ form bên trái</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Detail Modal ── */}
      {selected && <VenueDetailModal venue={selected} onClose={() => setSelected(null)} />}
    </div>
  );
};
