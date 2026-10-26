import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  ArrowUpDown,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  CreditCard,
  Calendar,
} from 'lucide-react';
import { OrderItem, OrderStatus } from '../../types/dashboard';
import { StatusBadge } from '../common/StatusBadge';

interface RecentOrdersTableProps {
  onSelectOrder?: (order: OrderItem) => void;
  orders?: OrderItem[];
}

export const RecentOrdersTable: React.FC<RecentOrdersTableProps> = ({ onSelectOrder, orders = [] }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sortField, setSortField] = useState<'date' | 'amount' | 'customer'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeMenuOrderId, setActiveMenuOrderId] = useState<string | null>(null);

  const itemsPerPage = 6;

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        order.id.toLowerCase().includes(search.toLowerCase()) ||
        order.customer.name.toLowerCase().includes(search.toLowerCase()) ||
        order.product.name.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = statusFilter === 'All' || order.status === statusFilter;

      return matchesSearch && matchesStatus;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortField === 'amount') {
        comparison = a.amount - b.amount;
      } else if (sortField === 'customer') {
        comparison = a.customer.name.localeCompare(b.customer.name);
      } else {
        comparison = a.date.localeCompare(b.date);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [orders, search, statusFilter, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage) || 1;
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const toggleSort = (field: 'date' | 'amount' | 'customer') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const statusTabLabels: Record<string, string> = {
    All: 'Tất cả',
    Pending: 'Chờ xác nhận',
    Processing: 'Đang thực hiện',
    Completed: 'Hoàn thành',
    Cancelled: 'Đã hủy',
  };

  return (
    <div className="rounded-2xl bg-white border border-[#E5EBE5] shadow-[0_2px_12px_rgba(28,43,32,0.04)] overflow-hidden">
      {/* Header with Title & Filter Controls */}
      <div className="p-5 border-b border-[#E5EBE5] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#1C2B20] tracking-tight">Danh Sách Lịch Đặt & Đơn Dịch Vụ</h2>
          <p className="text-xs text-[#66756B] mt-0.5">
            Quản lý và cập nhật tiến trình thực hiện ca trị liệu của kỹ thuật viên
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#94A399] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tìm mã đơn, tên khách..."
              className="pl-8 pr-3 py-1.5 rounded-xl bg-[#F6F8F4] border border-[#E5EBE5] text-xs text-[#1C2B20] placeholder-[#94A399] focus:outline-none focus:border-[#2E7D4A] w-48 sm:w-56"
            />
          </div>

          {/* Status filters */}
          <div className="flex items-center p-1 rounded-xl bg-[#F1F5EF] border border-[#E5EBE5]">
            {['All', 'Pending', 'Processing', 'Completed', 'Cancelled'].map((status) => {
              const isActive = statusFilter === status;
              return (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-[#2E7D4A] shadow-xs'
                       : 'bg-transparent text-[#1C2B20] hover:bg-white/80 hover:text-[#2E7D4A]'
                  }`}
                >
                  {statusTabLabels[status]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F6F8F4] text-[#66756B] text-xs font-semibold uppercase tracking-wider border-b border-[#E5EBE5]">
              <th className="py-3 px-4">Mã lịch đặt</th>
              <th
                onClick={() => toggleSort('customer')}
                className="py-3 px-4 cursor-pointer hover:text-[#1C2B20]"
              >
                <div className="flex items-center gap-1">
                  <span>Khách hàng</span>
                  <ArrowUpDown className="w-3 h-3 text-[#94A399]" />
                </div>
              </th>
              <th className="py-3 px-4">Gói dịch vụ</th>
              <th
                onClick={() => toggleSort('date')}
                className="py-3 px-4 cursor-pointer hover:text-[#1C2B20]"
              >
                <div className="flex items-center gap-1">
                  <span>Thời gian</span>
                  <ArrowUpDown className="w-3 h-3 text-[#94A399]" />
                </div>
              </th>
              <th
                onClick={() => toggleSort('amount')}
                className="py-3 px-4 text-right cursor-pointer hover:text-[#1C2B20]"
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Tổng tiền</span>
                  <ArrowUpDown className="w-3 h-3 text-[#94A399]" />
                </div>
              </th>
              <th className="py-3 px-4">Thanh toán</th>
              <th className="py-3 px-4">Trạng thái</th>
              <th className="py-3 px-4 text-right">Chi tiết</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#F1F5EF] text-sm text-[#1C2B20]">
            {paginatedOrders.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-xs text-[#94A399]">
                  Không tìm thấy lịch đặt nào phù hợp với bộ lọc.
                </td>
              </tr>
            ) : (
              paginatedOrders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => onSelectOrder?.(order)}
                  className="hover:bg-[#F6F8F4] transition-colors cursor-pointer h-16 group"
                >
                  <td className="py-3.5 px-4 font-mono font-bold text-xs text-[#2E7D4A]">
                    {order.id}
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={order.customer.avatar}
                        alt={order.customer.name}
                        className="w-8 h-8 rounded-full object-cover ring-1 ring-[#E5EBE5]"
                      />
                      <div>
                        <div className="font-bold text-xs text-[#1C2B20]">
                          {order.customer.name}
                        </div>
                        <div className="text-[11px] text-[#94A399] font-mono">
                          {order.customer.email}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-xs text-[#1C2B20] max-w-[200px] truncate">
                      {order.product.name}
                    </div>
                    <span className="text-[10px] text-[#94A399]">{order.product.category}</span>
                  </td>

                  <td className="py-3.5 px-4 text-xs text-[#66756B] whitespace-nowrap">
                    {order.date}
                  </td>

                  <td className="py-3.5 px-4 text-right font-bold text-xs text-[#1C2B20]">
                    {new Intl.NumberFormat('vi-VN').format(order.amount)} đ
                  </td>

                  <td className="py-3.5 px-4 text-xs text-[#66756B]">
                    <span className="inline-flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-[#94A399]" />
                      <span>{order.payment.cardLast4 || order.payment.method}</span>
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <StatusBadge status={order.status} size="sm" />
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectOrder?.(order);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[#2E7D4A] bg-[#EAF5EC] hover:bg-[#DDF0E1] transition-colors"
                    >
                      Xem chi tiết
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-5 py-3.5 border-t border-[#E5EBE5] flex items-center justify-between text-xs text-[#66756B]">
        <span>
          Hiển thị{' '}
          <strong className="text-[#1C2B20]">
            {(currentPage - 1) * itemsPerPage + 1} -{' '}
            {Math.min(currentPage * itemsPerPage, filteredOrders.length)}
          </strong>{' '}
          trên tổng số <strong className="text-[#1C2B20]">{filteredOrders.length}</strong> lịch đặt
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-[#E5EBE5] hover:bg-[#F6F8F4] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>
            Trang {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-[#E5EBE5] hover:bg-[#F6F8F4] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecentOrdersTable;
