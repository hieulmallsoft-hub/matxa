import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { ShoppingBag, CreditCard, Sparkles, User, Tag } from 'lucide-react';
import { useToast } from '../ui/ToastContainer';
import { OrderItem } from '../../types/dashboard';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: (newOrder: OrderItem) => void;
}

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({
  isOpen,
  onClose,
  onOrderCreated,
}) => {
  const { addToast } = useToast();
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [productName, setProductName] = useState('Neural Accelerator Pod v3');
  const [amount, setAmount] = useState('3499');
  const [paymentMethod, setPaymentMethod] = useState<'Stripe' | 'Credit Card' | 'Apple Pay' | 'Crypto USDT'>('Stripe');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !customerEmail) {
      addToast({
        title: 'Missing Details',
        message: 'Please provide both customer name and email.',
        type: 'error',
      });
      return;
    }

    const newOrder: OrderItem = {
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      customer: {
        name: customerName,
        email: customerEmail,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
        initials: customerName.substring(0, 2).toUpperCase(),
      },
      product: {
        name: productName,
        sku: 'GEN-CORE-X',
        category: 'Compute Core',
      },
      date: 'Just now',
      amount: parseFloat(amount) || 1200,
      payment: {
        method: paymentMethod,
        cardLast4: '9921',
      },
      status: 'Processing',
    };

    onOrderCreated?.(newOrder);
    onClose();
    addToast({
      title: 'Order Created',
      message: `Successfully booked order ${newOrder.id} for ${customerName}`,
      type: 'success',
    });

    // Reset
    setCustomerName('');
    setCustomerEmail('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Direct Enterprise Order"
      subtitle="Issue instant checkout transaction for VIP accounts"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1">CUSTOMER NAME</label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Dr. Jennifer Lawrence"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1">EMAIL ADDRESS</label>
          <input
            type="email"
            required
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="client@organization.com"
            className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">PRODUCT</label>
            <select
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="Neural Accelerator Pod v3">Neural Pod v3 ($3,499)</option>
              <option value="Cyber Sentinel Gateway">Sentinel Gateway ($1,850)</option>
              <option value="Holographic Display Terminal">Holo Terminal ($2,420)</option>
              <option value="OmniStream Realtime Broker">OmniStream ($1,190)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">AMOUNT ($ USD)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1">PAYMENT GATEWAY</label>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            {(['Stripe', 'Credit Card', 'Apple Pay', 'Crypto USDT'] as const).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                className={`py-2 px-3 rounded-xl border text-center transition-all ${
                  paymentMethod === method
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-medium'
                    : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-xs font-semibold shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 border border-white/20 transition-all cursor-pointer"
          >
            Submit Order
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateOrderModal;
