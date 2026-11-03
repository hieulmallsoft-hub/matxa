import type React from 'react';
import {
  LayoutDashboard,
  LineChart,
  CalendarDays,
  UsersRound,
  UserCheck,
  FolderTree,
  GraduationCap,
  Sparkles,
  HeartHandshake,
  MessageCircle,
  Bell,
  Settings,
  Store,
  FileText,
  ShieldCheck,
  Scale,
} from 'lucide-react';
import type { PageId } from './types/dashboard';

/** Live counters shown as menu badges; see useAdminCounts. */
export type CountKey = 'pendingBookings' | 'pendingApplications' | 'unreadSupport' | 'unreadNotifications';

export interface NavItem {
  id: PageId;
  label: string;
  /** One line shown in the menu tooltip, the page header and the command palette. */
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Extra words the menu search matches, e.g. "voucher" for Khuyến mãi. */
  keywords?: string;
  count?: CountKey;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

/** Single source of truth for the sidebar, mobile menu, top bar and command palette. */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Vận hành',
    items: [
      { id: 'dashboard', label: 'Tổng quan', description: 'Tình hình vận hành hôm nay', icon: LayoutDashboard, keywords: 'home trang chu' },
      { id: 'analytics', label: 'Doanh thu & Báo cáo', description: 'Doanh thu, xu hướng và báo cáo', icon: LineChart, keywords: 'bao cao thong ke' },
      { id: 'orders', label: 'Lịch đặt & Đơn hàng', description: 'Theo dõi và xử lý đơn đặt lịch', icon: CalendarDays, keywords: 'booking don dat lich', count: 'pendingBookings' },
    ],
  },
  {
    title: 'Quản lý',
    items: [
      { id: 'technicians', label: 'Kỹ thuật viên', description: 'Hồ sơ, trạng thái và bảng giá KTV', icon: UsersRound, keywords: 'ktv nhan vien' },
      { id: 'applications', label: 'Duyệt hồ sơ KTV', description: 'Hồ sơ đăng ký đang chờ duyệt', icon: UserCheck, keywords: 'ung tuyen dang ky', count: 'pendingApplications' },
      { id: 'catalog', label: 'Dịch vụ', description: 'Danh mục và gói giá dịch vụ', icon: FolderTree, keywords: 'service catalog goi gia' },
      { id: 'venues', label: 'Địa điểm & Spa', description: 'Spa, phòng tham vấn, đánh giá', icon: Store, keywords: 'spa dia diem venue' },
      { id: 'contracts', label: 'Mẫu hợp đồng KTV', description: 'Mẫu hợp đồng gửi kỹ thuật viên', icon: FileText, keywords: 'hop dong' },
      { id: 'courses', label: 'Khóa học đào tạo', description: 'Khóa học và bài học online', icon: GraduationCap, keywords: 'khoa hoc bai hoc' },
    ],
  },
  {
    title: 'Khách hàng & Marketing',
    items: [
      { id: 'promotions', label: 'Khuyến mãi & Banner', description: 'Mã ưu đãi và banner ứng dụng', icon: Sparkles, keywords: 'voucher ma giam gia banner' },
      { id: 'customers', label: 'Khách hàng', description: 'Danh sách và hồ sơ khách hàng', icon: HeartHandshake, keywords: 'user nguoi dung' },
      { id: 'messages', label: 'Tin nhắn CSKH', description: 'Chat hỗ trợ khách hàng', icon: MessageCircle, keywords: 'chat ho tro cskh', count: 'unreadSupport' },
    ],
  },
  {
    title: 'Hệ thống',
    items: [
      { id: 'notifications', label: 'Thông báo hệ thống', description: 'Hồ sơ mới, khiếu nại, đơn hết hạn, tin nhắn', icon: Bell, keywords: 'thong bao canh bao', count: 'unreadNotifications' },
      { id: 'complaints', label: 'Khiếu nại', description: 'Khiếu nại về đơn dịch vụ', icon: ShieldCheck, keywords: 'complaint' },
      { id: 'technicianPolicy', label: 'Chính sách KTV', description: 'Tỷ lệ hoa hồng và chính sách KTV', icon: Scale, keywords: 'hoa hong commission' },
      { id: 'settings', label: 'Cấu hình hệ thống', description: 'Thông tin nền tảng và cấu hình', icon: Settings, keywords: 'setting cai dat' },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

// Mock-data pages (payments, transactions, products) have no backend yet, so they are not routable;
// their URLs fall back to the dashboard.
export const ALL_PAGE_IDS = NAV_ITEMS.map((item) => item.id);

export const navItem = (id: PageId): NavItem => NAV_ITEMS.find((item) => item.id === id) ?? NAV_ITEMS[0];

/** Accent-insensitive match so "khuyen mai" finds "Khuyến mãi". */
export const normalizeSearch = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();

export const matchesNav = (item: NavItem, query: string) => {
  const needle = normalizeSearch(query);
  if (!needle) return true;
  return normalizeSearch(`${item.label} ${item.description} ${item.keywords ?? ''}`).includes(needle);
};
