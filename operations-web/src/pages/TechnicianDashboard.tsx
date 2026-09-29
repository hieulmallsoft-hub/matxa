import { FormEvent, useState } from 'react';
import { request } from '../api/client';
import { Card } from '../components/Card';
import { csv, FormCard, iso, optionalNumber, selected } from '../components/Form';
import type { Category } from '../types/api';
import {
  User,
  Sparkles,
  Calendar,
  Layers,
  PlusCircle,
  Clock,
  MapPin,
  Banknote,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';

type Props = {
  categories: Category[];
  notify: (message: string, error?: boolean) => void;
};

const submit = async (
  event: FormEvent<HTMLFormElement>,
  path: string,
  method: 'POST' | 'PATCH',
  body: unknown,
  notify: Props['notify'],
  reset = false
) => {
  event.preventDefault();
  try {
    await request(path, { method, body: JSON.stringify(body) });
    notify('Đã cập nhật thông tin thành công!');
    if (reset) event.currentTarget.reset();
  } catch (error) {
    notify(error instanceof Error ? error.message : 'Có lỗi xảy ra khi lưu dữ liệu', true);
  }
};

const COMMON_TAGS = [
  'Massage Thái Cổ Truyền',
  'Massage Body Đá Nóng',
  'Trị Liệu Cổ Vai Gáy',
  'Bấm Huyệt Shiatsu',
  'Massage Mẹ Bầu',
  'Chăm Sóc Da Mặt Chuyên Sâu',
];

export function TechnicianDashboard({ categories, notify }: Props) {
  const [activeTab, setActiveTab] = useState<'profile' | 'services' | 'schedule' | 'categories'>('profile');
  const [selectedTags, setSelectedTags] = useState<string[]>(['Massage Body Đá Nóng', 'Trị Liệu Cổ Vai Gáy']);
  const [servicePrice, setServicePrice] = useState<number | string>(350000);
  const [serviceDuration, setServiceDuration] = useState<number | string>(60);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  return (
    <div>
      {/* Navigation Tabs */}
      <nav className="tabs-nav">
        <button
          className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <User size={18} />
          <span>Hồ sơ Chuyên gia</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'services' ? 'active' : ''}`}
          onClick={() => setActiveTab('services')}
        >
          <Sparkles size={18} />
          <span>Gói Dịch vụ & Bảng giá</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          <Calendar size={18} />
          <span>Lịch làm việc & Ca rảnh</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          <Layers size={18} />
          <span>Danh mục liên kết ({categories.length})</span>
        </button>
      </nav>

      {/* Tab 1: Hồ sơ Kỹ thuật viên */}
      {activeTab === 'profile' && (
        <div className="grid two">
          <Card
            title="Hồ sơ Năng lực Kỹ thuật viên"
            subtitle="Thông tin hiển thị khi khách hàng tìm kiếm và chọn bạn làm dịch vụ"
            icon={<User size={20} />}
          >
            <FormCard
              onSubmit={(e) => {
                const f = new FormData(e.currentTarget);
                void submit(
                  e,
                  '/technician/profile',
                  'PATCH',
                  {
                    bio: f.get('bio') || undefined,
                    gender: f.get('gender') || undefined,
                    tags: selectedTags,
                    serviceModes: selected(e.currentTarget, 'serviceModes'),
                    city: f.get('city') || undefined,
                    address: f.get('address') || undefined,
                    latitude: optionalNumber(f.get('latitude')),
                    longitude: optionalNumber(f.get('longitude')),
                    isAvailable: (e.currentTarget.elements.namedItem('isAvailable') as HTMLInputElement).checked,
                  },
                  notify
                );
              }}
            >
              <label>
                Giới thiệu bản thân & Kinh nghiệm chuyên môn
                <textarea
                  name="bio"
                  maxLength={2000}
                  placeholder="Kỹ thuật viên hơn 6 năm kinh nghiệm trị liệu cột sống, từng làm việc tại các Spa 5 sao..."
                />
              </label>

              <div className="form-row">
                <label>
                  Giới tính
                  <select name="gender">
                    <option value="">Không chọn</option>
                    <option value="FEMALE">Nữ</option>
                    <option value="MALE">Nam</option>
                    <option value="OTHER">Khác</option>
                  </select>
                </label>
                <label>
                  Thành phố / Khu vực hoạt động
                  <input name="city" placeholder="TP. Hồ Chí Minh" />
                </label>
              </div>

              <div>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--emerald-100)' }}>
                  Kỹ năng chuyên môn (Bấm chọn nhanh):
                </span>
                <div className="tag-chips-wrapper">
                  {COMMON_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`tag-chip ${selectedTags.includes(tag) ? 'active' : ''}`}
                      onClick={() => toggleTag(tag)}
                    >
                      {selectedTags.includes(tag) ? '✓ ' : '+ '} {tag}
                    </button>
                  ))}
                </div>
              </div>

              <label>
                Hình thức phục vụ
                <select name="serviceModes" multiple required defaultValue={['HOME', 'ONSITE']}>
                  <option value="HOME">🏠 Tại nhà khách hàng (Home)</option>
                  <option value="ONSITE">🏢 Tại cơ sở / Spa đối tác (Onsite)</option>
                  <option value="ONLINE">💻 Tư vấn từ xa (Online)</option>
                </select>
              </label>

              <label>
                Địa chỉ cơ sở / Vị trí đón khách
                <input name="address" placeholder="Số 88 Trần Hưng Đạo, Quận 1" />
              </label>

              <div className="form-row">
                <label>
                  Vĩ độ (Latitude)
                  <input name="latitude" type="number" step="any" placeholder="10.762622" />
                </label>
                <label>
                  Kinh độ (Longitude)
                  <input name="longitude" type="number" step="any" placeholder="106.660172" />
                </label>
              </div>

              <label className="check">
                <input name="isAvailable" type="checkbox" defaultChecked />
                <span>🟢 Sẵn sàng nhận cuốc & đơn mới ngay bây giờ</span>
              </label>

              <button type="submit">
                <CheckCircle2 size={18} /> Cập nhật hồ sơ cá nhân
              </button>
            </FormCard>
          </Card>

          <Card
            title="Hướng dẫn & Tiêu chuẩn Vận hành KTV"
            subtitle="Các nguyên tắc vàng giữ vững đánh giá 5 sao từ khách hàng"
            icon={<Sparkles size={20} />}
          >
            <div style={{ display: 'grid', gap: '14px' }}>
              <div className="list-item-card">
                <div className="item-info">
                  <div className="item-avatar">
                    <Clock size={20} />
                  </div>
                  <div>
                    <div className="item-name">Đúng giờ tuyệt đối</div>
                    <div className="item-subtext">
                      Có mặt tại điểm hẹn trước 10-15 phút để chuẩn bị tinh dầu, khăn sạch và dụng cụ.
                    </div>
                  </div>
                </div>
              </div>

              <div className="list-item-card">
                <div className="item-info">
                  <div className="item-avatar">
                    <SlidersHorizontal size={20} />
                  </div>
                  <div>
                    <div className="item-name">Bật tắt trạng thái linh hoạt</div>
                    <div className="item-subtext">
                      Khi đang phục vụ khách hoặc bận việc cá nhân, hãy tắt nút Nhận đơn để tránh bị tính huỷ ca.
                    </div>
                  </div>
                </div>
              </div>

              <div className="list-item-card">
                <div className="item-info">
                  <div className="item-avatar">
                    <Banknote size={20} />
                  </div>
                  <div>
                    <div className="item-name">Thu nhập & Tiền Tip minh bạch</div>
                    <div className="item-subtext">
                      Toàn bộ tiền tip từ khách hàng và 85-90% doanh thu dịch vụ được đối soát hằng tuần.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: Thêm dịch vụ và bảng giá */}
      {activeTab === 'services' && (
        <div className="grid two">
          <Card
            title="Tạo Gói Dịch Vụ Mới"
            subtitle="Đăng gói massage / trị liệu và thiết lập mức giá của riêng bạn"
            icon={<Sparkles size={20} />}
          >
            <FormCard
              onSubmit={(e) => {
                const f = new FormData(e.currentTarget);
                void submit(
                  e,
                  '/technician/services',
                  'POST',
                  {
                    categoryId: f.get('categoryId'),
                    name: f.get('name'),
                    description: f.get('description') || undefined,
                    durationMinutes: Number(f.get('durationMinutes')),
                    price: Number(f.get('price')),
                    modes: selected(e.currentTarget, 'modes'),
                  },
                  notify,
                  true
                );
              }}
            >
              <label>
                Danh mục dịch vụ
                <select name="categoryId" required>
                  <option value="">-- Chọn danh mục phù hợp --</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Tên gói trị liệu / dịch vụ
                <input
                  name="name"
                  maxLength={150}
                  required
                  placeholder="Ví dụ: Massage Body Tinh Dầu Lavender Thư Giãn"
                />
              </label>

              <label>
                Mô tả chi tiết quy trình & lợi ích
                <textarea
                  name="description"
                  maxLength={1000}
                  placeholder="Bao gồm ngâm chân thảo dược, bấm huyệt lưu thông khí huyết, massage đá nóng giảm nhức mỏi..."
                />
              </label>

              <div className="form-row">
                <label>
                  Thời lượng phục vụ (Phút)
                  <input
                    name="durationMinutes"
                    type="number"
                    min="15"
                    max="720"
                    required
                    value={serviceDuration}
                    onChange={(e) => setServiceDuration(e.target.value)}
                  />
                </label>
                <label>
                  Đơn giá niêm yết (VNĐ)
                  <input
                    name="price"
                    type="number"
                    min="0"
                    required
                    value={servicePrice}
                    onChange={(e) => setServicePrice(e.target.value)}
                  />
                </label>
              </div>

              <label>
                Hình thức nhận phục vụ gói này
                <select name="modes" multiple required defaultValue={['HOME', 'ONSITE']}>
                  <option value="HOME">🏠 Tại nhà khách hàng (Home)</option>
                  <option value="ONSITE">🏢 Tại cơ sở / Spa (Onsite)</option>
                  <option value="ONLINE">💻 Trực tuyến (Online)</option>
                </select>
              </label>

              <button type="submit">
                <PlusCircle size={18} /> Thêm Gói Dịch Vụ
              </button>
            </FormCard>
          </Card>

          <Card
            title="Xem trước Gói Dịch vụ (Live Card Preview)"
            subtitle="Mô phỏng hiển thị dịch vụ trong menu chọn của khách hàng"
            icon={<Sparkles size={20} />}
          >
            <div className="live-preview-box">
              <span className="preview-badge">● HIỂN THỊ MENU DỊCH VỤ</span>
              <div
                style={{
                  background: 'rgba(8, 34, 24, 0.9)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '14px',
                  padding: '18px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', color: '#fff' }}>
                      Massage Trị Liệu Thư Giãn Chuyên Sâu
                    </h3>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                      <span className="role-badge" style={{ fontSize: '0.72rem' }}>
                        ⏱ {serviceDuration} phút
                      </span>
                      <span className="role-badge" style={{ fontSize: '0.72rem' }}>
                        🏠 Tại nhà & Cơ sở
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--gold-400)' }}>
                      {Number(servicePrice || 0).toLocaleString('vi-VN')} ₫
                    </span>
                  </div>
                </div>
                <p className="muted" style={{ fontSize: '0.84rem', marginTop: '12px' }}>
                  Giảm đau nhức các vùng cơ, kích thích tuần hoàn máu và đem lại cảm giác sảng khoái tức thì.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: Thêm lịch làm việc */}
      {activeTab === 'schedule' && (
        <div className="grid two">
          <Card
            title="Đăng Ký Khung Giờ Rảnh (Availability Slots)"
            subtitle="Mở lịch làm việc để khách hàng có thể đặt chỗ trước"
            icon={<Calendar size={20} />}
          >
            <FormCard
              onSubmit={(e) => {
                const f = new FormData(e.currentTarget);
                void submit(
                  e,
                  '/technician/availability',
                  'POST',
                  {
                    startAt: iso(f.get('startAt')),
                    endAt: iso(f.get('endAt')),
                  },
                  notify,
                  true
                );
              }}
            >
              <div className="form-row">
                <label>
                  Thời gian bắt đầu ca
                  <input name="startAt" type="datetime-local" required />
                </label>
                <label>
                  Thời gian kết thúc ca
                  <input name="endAt" type="datetime-local" required />
                </label>
              </div>

              <button type="submit">
                <PlusCircle size={18} /> Đăng Ký Khung Giờ
              </button>
            </FormCard>
            <p className="muted" style={{ marginTop: '14px', fontSize: '0.8rem' }}>
              💡 Hệ thống sẽ tự động gán timezone địa phương và hiển thị khung giờ này cho khách đặt trên app.
            </p>
          </Card>

          <Card
            title="Quy Tắc Quản Lý Lịch Làm Việc"
            subtitle="Giúp bạn tối ưu hoá doanh thu và không bị chồng chéo ca đặt"
            icon={<Clock size={20} />}
          >
            <div style={{ display: 'grid', gap: '12px' }}>
              <div className="list-item-card">
                <div className="item-info">
                  <div className="item-avatar">
                    <CheckCircle2 size={18} />
                  </div>
                  <div>
                    <div className="item-name">Khoá giờ tự động</div>
                    <div className="item-subtext">
                      Khi khách đặt và thanh toán thành công, khung giờ đó sẽ tự động đóng lại.
                    </div>
                  </div>
                </div>
              </div>
              <div className="list-item-card">
                <div className="item-info">
                  <div className="item-avatar">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <div className="item-name">Thời gian di chuyển</div>
                    <div className="item-subtext">
                      Hệ thống tự động chừa khoảng đệm 30 phút giữa các ca đặt tại nhà để bạn kịp di chuyển.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 4: Danh mục liên kết */}
      {activeTab === 'categories' && (
        <Card
          title="Danh Mục Dịch Vụ Đang Mở Cho Phép Đăng Gói"
          subtitle="Các phân loại dịch vụ mà quản trị viên đã phê duyệt trên hệ thống"
          icon={<Layers size={20} />}
        >
          <div className="grid three">
            {categories.length ? (
              categories.map((category) => (
                <div key={category.id} className="list-item-card">
                  <div className="item-info">
                    <div className="item-avatar">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <div className="item-name">{category.name}</div>
                      <div className="item-subtext">slug: {category.slug}</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '24px' }}>
                Chưa có danh mục nào đang active.
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
