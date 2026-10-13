import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, Plus, Download, Filter, RefreshCw } from 'lucide-react';
import { RecentOrdersTable } from '../components/dashboard/RecentOrdersTable';
import { OrderDetailsModal } from '../components/dashboard/OrderDetailsModal';
import { CreateOrderModal } from '../components/dashboard/CreateOrderModal';
import { OrderItem } from '../types/dashboard';
import { useToast } from '../components/ui/ToastContainer';

export const OrdersPage: React.FC = () => {
  const { addToast } = useToast();
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleExportCSV = () => {
    addToast({
      title: 'Export Complete',
      message: 'Orders CSV export downloaded successfully (7 transactions).',
      type: 'success',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.4 }}
      className="space-y-8 pb-16"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-[#0D101C]/80 border border-white/10 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">
              Orders Management
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-gateway order settlement ledger with cryptographic dispute resolution
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-xs font-semibold shadow-lg shadow-cyan-500/25 border border-white/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Order</span>
          </button>
        </div>
      </div>

      {/* Orders Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Settled Orders', value: '8,429', badge: '+8.2% vs last mo', color: 'text-cyan-400' },
          { label: 'Average Order Value', value: '$428.10', badge: '+$34.20 higher', color: 'text-emerald-400' },
          { label: 'Fulfillment Velocity', value: '99.4%', badge: '< 4 min settlement', color: 'text-violet-400' },
          { label: 'Dispute / Refund Rate', value: '0.08%', badge: 'Industry benchmark: 1.2%', color: 'text-amber-400' },
        ].map((item, i) => (
          <div key={i} className="p-5 rounded-2xl bg-[#0E1220]/80 border border-white/10 backdrop-blur-xl">
            <span className="text-[11px] font-mono text-slate-400 uppercase">{item.label}</span>
            <div className={`text-2xl font-bold font-mono ${item.color} mt-1`}>{item.value}</div>
            <div className="text-[11px] text-slate-400 font-mono mt-1">{item.badge}</div>
          </div>
        ))}
      </div>

      {/* Main Interactive Table */}
      <RecentOrdersTable onSelectOrder={setSelectedOrder} />

      {/* Modals */}
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />

      <CreateOrderModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </motion.div>
  );
};

export default OrdersPage;
