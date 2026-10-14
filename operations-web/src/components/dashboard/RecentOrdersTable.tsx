import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  ArrowUpDown,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  CreditCard,
  SlidersHorizontal,
} from 'lucide-react';
import { OrderItem, OrderStatus } from '../../types/dashboard';
import { RECENT_ORDERS } from '../../data/mockData';

interface RecentOrdersTableProps {
  onSelectOrder?: (order: OrderItem) => void;
}

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; bg: string; text: string; border: string; glow: string; icon: any }
> = {
  Completed: {
    label: 'Hoàn thành',
    bg: 'bg-[#385723]/30',
    text: 'text-[#C7D9B5]',
    border: 'border-[#94AB71]/50',
    glow: 'shadow-[0_0_12px_rgba(56,87,35,0.4)]',
    icon: CheckCircle2,
  },
  Processing: {
    label: 'Đang xử lý',
    bg: 'bg-[#94AB71]/25',
    text: 'text-[#FFFAF5]',
    border: 'border-[#94AB71]/50',
    glow: 'shadow-[0_0_12px_rgba(148,171,113,0.3)]',
    icon: Loader2,
  },
  Pending: {
    label: 'Chờ xác nhận',
    bg: 'bg-[#F9EDB2]/20',
    text: 'text-[#F9EDB2]',
    border: 'border-[#F9EDB2]/40',
    glow: 'shadow-[0_0_12px_rgba(249,237,178,0.3)]',
    icon: Clock,
  },
  Cancelled: {
    label: 'Đã hủy',
    bg: 'bg-rose-500/15',
    text: 'text-rose-300',
    border: 'border-rose-500/30',
    glow: 'shadow-[0_0_12px_rgba(244,63,94,0.2)]',
    icon: XCircle,
  },
};

export const RecentOrdersTable: React.FC<RecentOrdersTableProps> = ({ onSelectOrder }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sortField, setSortField] = useState<'date' | 'amount' | 'customer'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeMenuOrderId, setActiveMenuOrderId] = useState<string | null>(null);

  const itemsPerPage = 5;

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    return RECENT_ORDERS.filter((order) => {
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
  }, [search, statusFilter, sortField, sortOrder]);

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

  return (
    <div className="rounded-3xl bg-[#001910]/90 border border-[#385723]/40 p-6 backdrop-blur-xl shadow-xl relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/3 w-64 h-64 bg-[#385723]/20 rounded-full blur-[80px] pointer-events-none" />

      {/* Header with Title & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#385723]/30">
        <div>
          <h2 className="text-lg font-bold text-[#FFFAF5] tracking-wide">Lịch Hẹn & Đơn Hàng Gần Đây</h2>
          <p className="text-xs text-[#C7D9B5]/80 mt-1">
            Giao dịch đăng ký liệu trình, khóa đào tạo và sản phẩm chăm sóc toàn chuỗi
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#94AB71] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tìm mã đơn, khách hàng..."
              className="pl-9 pr-3 py-1.5 rounded-xl bg-[#001910] border border-[#385723]/50 text-xs text-[#FFFAF5] placeholder-[#94AB71]/60 focus:outline-none focus:border-[#94AB71] w-48 sm:w-56"
            />
          </div>

          {/* Status filters */}
          <div className="flex items-center p-1 rounded-xl bg-[#001910] border border-[#385723]/50">
            {['All', 'Completed', 'Processing', 'Pending', 'Cancelled'].map((status) => {
              const isActive = statusFilter === status;
              const labelMap: Record<string, string> = {
                All: 'Tất cả',
                Completed: 'Hoàn thành',
                Processing: 'Đang xử lý',
                Pending: 'Chờ',
                Cancelled: 'Hủy',
              };
              return (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-[#385723] to-[#4d7530] text-[#FFFAF5] border border-[#94AB71]/40 shadow-sm'
                      : 'text-[#C7D9B5]/70 hover:text-[#FFFAF5]'
                  }`}
                >
                  {labelMap[status] || status}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#385723]/30 text-[#94AB71] uppercase font-mono text-[10px] tracking-wider">
              <th className="py-3.5 px-3">Mã đơn</th>
              <th
                className="py-3.5 px-3 cursor-pointer hover:text-[#FFFAF5] transition-colors"
                onClick={() => toggleSort('customer')}
              >
                <div className="flex items-center gap-1">
                  <span>Khách hàng</span>
                  <ArrowUpDown className="w-3 h-3 text-[#94AB71]/70" />
                </div>
              </th>
              <th className="py-3.5 px-3">Dịch vụ / Sản phẩm</th>
              <th
                className="py-3.5 px-3 cursor-pointer hover:text-[#FFFAF5] transition-colors"
                onClick={() => toggleSort('date')}
              >
                <div className="flex items-center gap-1">
                  <span>Ngày tạo</span>
                  <ArrowUpDown className="w-3 h-3 text-[#94AB71]/70" />
                </div>
              </th>
              <th
                className="py-3.5 px-3 cursor-pointer hover:text-[#FFFAF5] transition-colors text-right"
                onClick={() => toggleSort('amount')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Số tiền</span>
                  <ArrowUpDown className="w-3 h-3 text-[#94AB71]/70" />
                </div>
              </th>
              <th className="py-3.5 px-3">Thanh toán</th>
              <th className="py-3.5 px-3">Trạng thái</th>
              <th className="py-3.5 px-3 text-right">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#385723]/20">
            {paginatedOrders.map((order) => {
              const statusCfg = STATUS_CONFIG[order.status];
              const StatusIcon = statusCfg.icon;

              return (
                <tr
                  key={order.id}
                  onClick={() => onSelectOrder?.(order)}
                  className="hover:bg-[#385723]/15 transition-colors group cursor-pointer"
                >
                  {/* Order ID */}
                  <td className="py-3.5 px-3 font-mono font-medium text-[#F9EDB2]">
                    {order.id}
                  </td>

                  {/* Customer */}
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={order.customer.avatar}
                        alt={order.customer.name}
                        className="w-7 h-7 rounded-full object-cover ring-1 ring-[#385723]/50"
                      />
                      <div>
                        <div className="font-semibold text-[#FFFAF5] group-hover:text-[#F9EDB2] transition-colors">
                          {order.customer.name}
                        </div>
                        <div className="text-[10px] text-[#C7D9B5]/70 font-mono">
                          {order.customer.email}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Product */}
                  <td className="py-3.5 px-3">
                    <div className="text-[#C7D9B5] font-medium">{order.product.name}</div>
                    <div className="text-[10px] text-[#94AB71]/80 font-mono">
                      {order.product.sku}
                    </div>
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-3 font-mono text-[#C7D9B5]/80">
                    {order.date}
                  </td>

                  {/* Amount */}
                  <td className="py-3.5 px-3 text-right font-mono font-bold text-[#FFFAF5] text-sm">
                    ${order.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>

                  {/* Payment */}
                  <td className="py-3.5 px-3">
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#001910] border border-[#385723]/40 text-[11px] text-[#C7D9B5]">
                      <CreditCard className="w-3 h-3 text-[#94AB71]" />
                      <span>{order.payment.method}</span>
                    </div>
                  </td>

                  {/* Status Pill */}
                  <td className="py-3.5 px-3">
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border} ${statusCfg.glow}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      <span>{statusCfg.label}</span>
                    </div>
                  </td>

                  {/* Action */}
                  <td className="py-3.5 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectOrder?.(order);
                      }}
                      className="p-1 rounded-lg text-[#C7D9B5]/70 hover:text-[#FFFAF5] hover:bg-[#385723]/25 transition-colors"
                      title="Xem chi tiết đơn"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View */}
      <div className="md:hidden space-y-3 pt-3">
        {paginatedOrders.map((order) => {
          const statusCfg = STATUS_CONFIG[order.status];
          return (
            <div
              key={order.id}
              onClick={() => onSelectOrder?.(order)}
              className="p-4 rounded-2xl bg-[#001910]/80 border border-[#385723]/40 space-y-3 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#F9EDB2]">{order.id}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                >
                  {statusCfg.label}
                </span>
              </div>

              <div className="flex items-center gap-2.5">
                <img
                  src={order.customer.avatar}
                  alt={order.customer.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <div>
                  <div className="text-xs font-semibold text-[#FFFAF5]">{order.customer.name}</div>
                  <div className="text-[10px] text-[#94AB71] font-mono">{order.product.name}</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#385723]/30 text-xs font-mono">
                <span className="text-[#C7D9B5]/80">{order.date}</span>
                <span className="text-sm font-bold text-[#FFFAF5]">${order.amount.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Footer */}
      <div className="mt-4 pt-4 border-t border-[#385723]/30 flex items-center justify-between text-xs text-[#C7D9B5]/80">
        <span className="font-mono text-[11px]">
          Hiển thị {paginatedOrders.length} trên tổng số {filteredOrders.length} đơn
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-[#385723]/40 hover:bg-[#385723]/20 disabled:opacity-30 disabled:cursor-not-allowed text-[#FFFAF5]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono text-[11px] px-2 text-[#FFFAF5]">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-[#385723]/40 hover:bg-[#385723]/20 disabled:opacity-30 disabled:cursor-not-allowed text-[#FFFAF5]"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecentOrdersTable;
