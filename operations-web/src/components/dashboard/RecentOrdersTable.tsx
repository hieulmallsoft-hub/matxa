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
    label: 'Completed',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    glow: 'shadow-[0_0_12px_rgba(16,185,129,0.25)]',
    icon: CheckCircle2,
  },
  Processing: {
    label: 'Processing',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
    glow: 'shadow-[0_0_12px_rgba(6,182,212,0.25)]',
    icon: Loader2,
  },
  Pending: {
    label: 'Pending',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    glow: 'shadow-[0_0_12px_rgba(245,158,11,0.25)]',
    icon: Clock,
  },
  Cancelled: {
    label: 'Cancelled',
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    glow: 'shadow-[0_0_12px_rgba(244,63,94,0.25)]',
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
    <div className="rounded-3xl bg-[#0D101C]/85 border border-white/10 p-6 backdrop-blur-xl shadow-xl relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/3 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none" />

      {/* Header with Title & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <h2 className="text-lg font-bold text-white tracking-wide">Recent Orders</h2>
          <p className="text-xs text-slate-400 mt-1">
            Global checkout settlement transactions across all enterprise tiers
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search order ID, client..."
              className="pl-9 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 w-48 sm:w-56"
            />
          </div>

          {/* Status filters */}
          <div className="flex items-center p-1 rounded-xl bg-black/40 border border-white/10">
            {['All', 'Completed', 'Processing', 'Pending', 'Cancelled'].map((status) => {
              const isActive = statusFilter === status;
              return (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status);
                    setCurrentPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {status}
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
            <tr className="border-b border-white/5 text-slate-400 uppercase font-mono text-[10px] tracking-wider">
              <th className="py-3.5 px-3">Order ID</th>
              <th
                className="py-3.5 px-3 cursor-pointer hover:text-white transition-colors"
                onClick={() => toggleSort('customer')}
              >
                <div className="flex items-center gap-1">
                  <span>Customer</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th className="py-3.5 px-3">Product</th>
              <th
                className="py-3.5 px-3 cursor-pointer hover:text-white transition-colors"
                onClick={() => toggleSort('date')}
              >
                <div className="flex items-center gap-1">
                  <span>Date</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th
                className="py-3.5 px-3 cursor-pointer hover:text-white transition-colors text-right"
                onClick={() => toggleSort('amount')}
              >
                <div className="flex items-center justify-end gap-1">
                  <span>Amount</span>
                  <ArrowUpDown className="w-3 h-3 text-slate-500" />
                </div>
              </th>
              <th className="py-3.5 px-3">Payment</th>
              <th className="py-3.5 px-3">Status</th>
              <th className="py-3.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {paginatedOrders.map((order) => {
              const statusCfg = STATUS_CONFIG[order.status];
              const StatusIcon = statusCfg.icon;

              return (
                <tr
                  key={order.id}
                  onClick={() => onSelectOrder?.(order)}
                  className="hover:bg-white/[0.03] transition-colors group cursor-pointer"
                >
                  {/* Order ID */}
                  <td className="py-3.5 px-3 font-mono font-medium text-cyan-400">
                    {order.id}
                  </td>

                  {/* Customer */}
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={order.customer.avatar}
                        alt={order.customer.name}
                        className="w-7 h-7 rounded-full object-cover ring-1 ring-white/10"
                      />
                      <div>
                        <div className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
                          {order.customer.name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {order.customer.email}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Product */}
                  <td className="py-3.5 px-3">
                    <div className="text-slate-200 font-medium">{order.product.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {order.product.sku}
                    </div>
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-3 font-mono text-slate-400">
                    {order.date}
                  </td>

                  {/* Amount */}
                  <td className="py-3.5 px-3 text-right font-mono font-bold text-white text-sm">
                    ${order.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>

                  {/* Payment */}
                  <td className="py-3.5 px-3">
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[11px] text-slate-300">
                      <CreditCard className="w-3 h-3 text-slate-400" />
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
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                      title="Inspect order details"
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
              className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-cyan-400">{order.id}</span>
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
                  <div className="text-xs font-semibold text-white">{order.customer.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{order.product.name}</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs font-mono">
                <span className="text-slate-400">{order.date}</span>
                <span className="text-sm font-bold text-white">${order.amount.toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Footer */}
      <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
        <span className="font-mono text-[11px]">
          Showing {paginatedOrders.length} of {filteredOrders.length} orders
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed text-white"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-mono text-[11px] px-2 text-white">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed text-white"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecentOrdersTable;
