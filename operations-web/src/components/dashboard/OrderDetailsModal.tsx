import React from 'react';
import { Modal } from '../ui/Modal';
import {
  OrderItem,
  OrderStatus,
} from '../../types/dashboard';
import {
  CreditCard,
  CheckCircle2,
  Calendar,
  User,
  ShoppingBag,
  Download,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '../ui/ToastContainer';

interface OrderDetailsModalProps {
  order: OrderItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  isOpen,
  onClose,
}) => {
  const { addToast } = useToast();

  if (!order) return null;

  const handleDownloadInvoice = () => {
    addToast({
      title: 'Invoice Downloaded',
      message: `Tax receipt generated for order ${order.id}`,
      type: 'success',
    });
  };

  const handleRecheckSettlement = () => {
    addToast({
      title: 'Settlement Re-verified',
      message: `Cryptographic consensus verified on Arbitrum L2 for ${order.id}`,
      type: 'info',
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Order Intelligence • ${order.id}`}
      subtitle="Complete immutable transaction ledger entry"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Top Summary Banner */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-mono text-slate-400">TOTAL TRANSACTION AMOUNT</div>
            <div className="text-2xl font-bold font-mono text-white mt-0.5">
              ${order.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="text-right">
            <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {order.status}
            </span>
            <div className="text-[10px] text-slate-500 font-mono mt-1">{order.date}</div>
          </div>
        </div>

        {/* Customer Information */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase">
            <User className="w-3.5 h-3.5" /> Client Entity
          </div>
          <div className="flex items-center gap-3">
            <img
              src={order.customer.avatar}
              alt={order.customer.name}
              className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10"
            />
            <div>
              <div className="font-semibold text-white text-sm">{order.customer.name}</div>
              <div className="text-xs text-slate-400 font-mono">{order.customer.email}</div>
            </div>
          </div>
        </div>

        {/* Product Details */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono text-violet-400 uppercase">
            <ShoppingBag className="w-3.5 h-3.5" /> Hardware / License Specification
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-white text-sm">{order.product.name}</div>
              <div className="text-xs text-slate-400 font-mono">
                SKU: {order.product.sku} • Category: {order.product.category}
              </div>
            </div>
            <span className="font-mono text-sm font-bold text-white">
              ${order.amount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Payment & Security Metadata */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 grid grid-cols-2 gap-3 text-xs font-mono">
          <div>
            <span className="text-slate-500 block mb-0.5">PAYMENT METHOD</span>
            <span className="text-slate-200 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
              {order.payment.method} {order.payment.cardLast4 ? `(•••• ${order.payment.cardLast4})` : ''}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block mb-0.5">SECURITY AUDIT</span>
            <span className="text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> 3D SECURE PASSED
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
          <button
            onClick={handleRecheckSettlement}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors font-mono"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Re-audit Hash
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadInvoice}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 text-xs font-medium transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Invoice</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default OrderDetailsModal;
