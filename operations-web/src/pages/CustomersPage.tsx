import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  UserPlus,
  Search,
  Mail,
  Phone,
  Shield,
  Star,
  DollarSign,
  HeartHandshake,
  CalendarDays,
  Sparkles,
  Award,
  ChevronRight,
  Clock,
  MessageCircle,
} from 'lucide-react';
import { useToast } from '../components/ui/ToastContainer';
import { PageHeader } from '../components/common/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { SectionCard } from '../components/common/SectionCard';
import { SearchInput, FilterTabs } from '../components/common/FilterBar';
import { DetailDrawer } from '../components/common/DetailDrawer';
import { StatusBadge } from '../components/common/StatusBadge';
import { request } from '../api/client';

interface CustomerEntity {
  id: string;
  name: string;
  phone: string;
  email: string;
  tier: 'VIP Platinum' | 'Gold Member' | 'Silver' | 'Thành viên mới';
  spent: number;
  orders: number;
  lastBooking: string;
  favoriteService: string;
  address: string;
  status: 'ACTIVE' | 'INACTIVE';
  avatar: string;
}

const CUSTOMER_ENTITIES: CustomerEntity[] = [
  {
    id: 'CUST-1049',
    name: 'Nguyễn Thị Lan Anh',
    phone: '0901 888 234',
    email: 'lananh.nguyen@wellness.vn',
    tier: 'VIP Platinum',
    spent: 18450000,
    orders: 24,
    lastBooking: 'Hôm nay, 09:30',
    favoriteService: 'Massage Trị Liệu Cổ Vai Gáy Chuyên Sâu',
    address: 'Quận 1, TP. Hồ Chí Minh',
    status: 'ACTIVE',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: 'CUST-1048',
    name: 'Trần Minh Hoàng',
    phone: '0903 555 888',
    email: 'hoang.tran@techcorp.vn',
    tier: 'Gold Member',
    spent: 9800000,
    orders: 14,
    lastBooking: 'Hôm qua, 15:00',
    favoriteService: 'Massage Shiatsu Nhật Bản & Bấm Huyệt',
    address: 'Quận 3, TP. Hồ Chí Minh',
    status: 'ACTIVE',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: 'CUST-1047',
    name: 'Lê Thu Hà',
    phone: '0912 666 777',
    email: 'ha.lethu@creative.com',
    tier: 'VIP Platinum',
    spent: 24600000,
    orders: 31,
    lastBooking: '2 ngày trước',
    favoriteService: 'Combo Thư Giãn Toàn Diện 120 Phút',
    address: 'Cầu Giấy, Hà Nội',
    status: 'ACTIVE',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: 'CUST-1046',
    name: 'Phạm Tuấn Anh',
    phone: '0988 222 333',
    email: 'anh.pham@apex.vn',
    tier: 'Silver',
    spent: 4200000,
    orders: 6,
    lastBooking: '4 ngày trước',
    favoriteService: 'Massage Đá Nóng Himalaya Phục Hồi',
    address: 'Ba Đình, Hà Nội',
    status: 'ACTIVE',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: 'CUST-1045',
    name: 'Vũ Quỳnh Trang',
    phone: '0933 999 111',
    email: 'trang.vu@fashion.vn',
    tier: 'Thành viên mới',
    spent: 1250000,
    orders: 1,
    lastBooking: '1 tuần trước',
    favoriteService: 'Chăm Sóc Da Mặt Nâng Cơ Chuyên Sâu',
    address: 'Hải Châu, Đà Nẵng',
    status: 'ACTIVE',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
  },
];

export const CustomersPage: React.FC = () => {
  const { addToast } = useToast();
  const [customers, setCustomers] = useState<CustomerEntity[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerEntity | null>(null);

  useEffect(() => {
    void request<{ items?: Array<{ id: string; displayName?: string | null; email?: string | null; phoneNumber?: string | null; status?: string; role?: string }> ; total?: number }>('/admin/marketplace/users?limit=100')
      .then((result) => setCustomers((result.items ?? []).filter((user) => (user.role ?? '').toUpperCase() === 'CUSTOMER').map((user) => ({
        id: user.id, name: user.displayName || 'Chưa cập nhật', phone: user.phoneNumber || 'Chưa cập nhật', email: user.email || '', tier: 'Thành viên mới', spent: 0, orders: 0, lastBooking: 'Chưa có', favoriteService: '', address: 'Chưa cập nhật', status: user.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE', avatar: '',
      }))))
      .catch((error) => addToast({ title: 'Không tải được khách hàng', message: error instanceof Error ? error.message : 'Vui lòng thử lại', type: 'error' }));
  }, [addToast]);

  const filtered = customers.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchTier = selectedTier === 'ALL' || c.tier === selectedTier;
    return matchSearch && matchTier;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-6 pb-12"
    >
      {/* 1. Header */}
      <PageHeader
        title="Quản lý Khách hàng"
        subtitle="Danh sách khách hàng, lịch sử sử dụng dịch vụ và phân hạng hội viên"
        badge="3.920 hội viên"
        badgeTone="green"
        breadcrumbs={[
          { label: 'MATXXA' },
          { label: 'Khách hàng' },
        ]}
        actions={
          <button
            onClick={() =>
              addToast({
                title: 'Thêm khách hàng',
                message: 'Vui lòng nhập thông tin khách hàng tại biểu mẫu liên kết.',
                type: 'info',
              })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Thêm khách hàng mới</span>
          </button>
        }
      />

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Tổng số khách hàng"
          value="3.920 khách"
          change={15.8}
          isPositive={true}
          caption="toàn hệ thống"
          icon={<Users className="w-5 h-5" />}
          tone="primary"
          sparkline={[310, 325, 340, 355, 370, 382, 392]}
        />
        <StatCard
          label="Khách mới tháng này"
          value="535 khách"
          change={22.4}
          isPositive={true}
          caption="tăng trưởng 22%"
          icon={<UserPlus className="w-5 h-5" />}
          tone="success"
          sparkline={[410, 435, 460, 485, 510, 525, 535]}
        />
        <StatCard
          label="Khách hàng quay lại"
          value="88.8%"
          change={3.2}
          isPositive={true}
          caption="tỷ lệ giữ chân cao"
          icon={<HeartHandshake className="w-5 h-5" />}
          tone="info"
          sparkline={[84, 85, 86, 86.8, 87.5, 88.2, 88.8]}
        />
        <StatCard
          label="Khách VIP Platinum"
          value="480 khách"
          change={8.5}
          isPositive={true}
          caption="đóng góp 62% doanh thu"
          icon={<Award className="w-5 h-5" />}
          tone="warning"
          sparkline={[420, 435, 448, 455, 468, 475, 480]}
        />
      </div>

      {/* 3. Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-[#E5EBE5] shadow-2xs">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Tìm tên khách hàng, số điện thoại, email..."
        />

        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
          {[
            { key: 'ALL', label: 'Tất cả hạng' },
            { key: 'VIP Platinum', label: 'VIP Platinum' },
            { key: 'Gold Member', label: 'Gold Member' },
            { key: 'Silver', label: 'Silver' },
            { key: 'Thành viên mới', label: 'Thành viên mới' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedTier(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedTier === tab.key
                  ? 'bg-[#EAF5EC] text-[#2E7D4A]'
                  : 'text-[#66756B] hover:text-[#1C2B20] hover:bg-[#F6F8F4]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Main Customer Table */}
      <SectionCard title="Danh sách khách hàng" subtitle={`${filtered.length} tài khoản khách hàng`} noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F8F4] text-[#66756B] uppercase font-semibold border-b border-[#E5EBE5]">
              <tr>
                <th className="py-3 px-4">Khách hàng</th>
                <th className="py-3 px-4">Số điện thoại</th>
                <th className="py-3 px-4">Khu vực</th>
                <th className="py-3 px-4">Số đơn</th>
                <th className="py-3 px-4 text-right">Tổng chi tiêu</th>
                <th className="py-3 px-4">Lần đặt gần nhất</th>
                <th className="py-3 px-4">Hạng thành viên</th>
                <th className="py-3 px-4 text-right">Hồ sơ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5EF] text-sm text-[#1C2B20]">
              {filtered.map((cust) => (
                <tr
                  key={cust.id}
                  onClick={() => setSelectedCustomer(cust)}
                  className="hover:bg-[#F6F8F4] transition-colors cursor-pointer h-16 group"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={cust.avatar}
                        alt={cust.name}
                        className="w-9 h-9 rounded-full object-cover ring-1 ring-[#E5EBE5]"
                      />
                      <div>
                        <div className="font-bold text-xs text-[#1C2B20]">{cust.name}</div>
                        <div className="text-[11px] text-[#94A399] font-mono">{cust.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-[#66756B]">
                    {cust.phone}
                  </td>
                  <td className="py-3 px-4 text-xs font-medium text-[#66756B]">
                    {cust.address}
                  </td>
                  <td className="py-3 px-4 font-bold text-xs text-[#2E7D4A]">
                    {cust.orders} đơn
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-xs text-[#1C2B20]">
                    {new Intl.NumberFormat('vi-VN').format(cust.spent)} đ
                  </td>
                  <td className="py-3 px-4 text-xs text-[#66756B] whitespace-nowrap">
                    {cust.lastBooking}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                        cust.tier === 'VIP Platinum'
                          ? 'bg-[#FEF6E9] text-[#B87A14] border-[#FBE3B8]'
                          : cust.tier === 'Gold Member'
                          ? 'bg-[#EAF5EC] text-[#2E7D4A] border-[#D0E7D5]'
                          : 'bg-[#F1F5EF] text-[#66756B] border-[#E5EBE5]'
                      }`}
                    >
                      {cust.tier}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCustomer(cust);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#2E7D4A] bg-[#EAF5EC] hover:bg-[#DDF0E1] transition-colors"
                    >
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* 5. Customer Detail Drawer */}
      <DetailDrawer
        isOpen={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        title={selectedCustomer ? `Hồ sơ khách hàng • ${selectedCustomer.name}` : ''}
        subtitle="Thông tin chi tiết, lịch sử sử dụng dịch vụ và dịch vụ yêu thích"
        badge={
          selectedCustomer ? (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF6E9] text-[#B87A14] border border-[#FBE3B8]">
              {selectedCustomer.tier}
            </span>
          ) : undefined
        }
      >
        {selectedCustomer && (
          <div className="space-y-6">
            {/* Profile Avatar Card */}
            <div className="p-4 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] flex items-center gap-4">
              <img
                src={selectedCustomer.avatar}
                alt={selectedCustomer.name}
                className="w-16 h-16 rounded-full object-cover ring-2 ring-[#EAF5EC]"
              />
              <div className="space-y-1">
                <h4 className="font-bold text-base text-[#1C2B20]">{selectedCustomer.name}</h4>
                <div className="text-xs text-[#66756B] flex items-center gap-3">
                  <span>SĐT: {selectedCustomer.phone}</span>
                  <span>•</span>
                  <span>{selectedCustomer.address}</span>
                </div>
                <div className="text-[11px] text-[#2E7D4A] font-semibold">
                  Hội viên thân thiết từ tháng 01/2026
                </div>
              </div>
            </div>

            {/* Spent & Orders Stats */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-white border border-[#E5EBE5] space-y-1">
                <span className="text-[#66756B] block">Tổng chi tiêu</span>
                <span className="font-bold text-base text-[#2E7D4A]">
                  {new Intl.NumberFormat('vi-VN').format(selectedCustomer.spent)} đ
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-white border border-[#E5EBE5] space-y-1">
                <span className="text-[#66756B] block">Tổng số ca phục vụ</span>
                <span className="font-bold text-base text-[#1C2B20]">
                  {selectedCustomer.orders} lịch đặt
                </span>
              </div>
            </div>

            {/* Favorite Service */}
            <div className="p-4 rounded-xl bg-white border border-[#E5EBE5] space-y-2">
              <span className="text-xs font-bold text-[#66756B] uppercase tracking-wider block">
                Dịch vụ yêu thích
              </span>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#EAF5EC] text-[#2E7D4A] flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-xs text-[#1C2B20]">{selectedCustomer.favoriteService}</div>
                  <div className="text-[11px] text-[#94A399]">Đã đặt 18 lần trong năm nay</div>
                </div>
              </div>
            </div>

            {/* CSKH & Notes */}
            <div className="p-4 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] space-y-2 text-xs">
              <span className="font-bold text-[#1C2B20] block">Ghi chú chăm sóc khách hàng:</span>
              <p className="text-[#66756B] leading-relaxed">
                Khách thích kỹ thuật viên Lê Thu Hương hoặc Nguyễn Thị Mai. Ưu tiên khung giờ buổi tối từ 19:00 - 21:00. Yêu cầu khăn và ga giường tinh dầu quế.
              </p>
            </div>
          </div>
        )}
      </DetailDrawer>
    </motion.div>
  );
};

export default CustomersPage;
