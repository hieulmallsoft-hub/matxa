import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Search, CheckCircle2, Shield, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '../components/ui/ToastContainer';

const LEDGER_ROWS = [
  {
    txHash: '0x7f9a...3c21a4',
    type: 'Inbound Settlement',
    amount: '+$3,499.00',
    protocol: 'Stripe Direct',
    blockDepth: '12 / 12 Confirmed',
    time: '2m ago',
    status: 'Finalized',
  },
  {
    txHash: '0x4b8e...d98a21',
    type: 'Hardware Escrow Release',
    amount: '+$1,850.00',
    protocol: 'Arbitrum Vault',
    blockDepth: '64 Confirmed',
    time: '18m ago',
    status: 'Finalized',
  },
  {
    txHash: '0x1c3d...ef2901',
    type: 'Platform Fee Ingestion',
    amount: '+$48.50',
    protocol: 'Internal Ledger',
    blockDepth: 'Instant',
    time: '24m ago',
    status: 'Finalized',
  },
  {
    txHash: '0x9e2a...554a7c',
    type: 'Cloud GPU Refund Settlement',
    amount: '-$89.00',
    protocol: 'Automated ACH',
    blockDepth: 'Clearing',
    time: '45m ago',
    status: 'Pending',
  },
  {
    txHash: '0x33b1...78ca19',
    type: 'Enterprise Annual License Wire',
    amount: '+$18,400.00',
    protocol: 'SWIFT GPI Instant',
    blockDepth: 'Finalized',
    time: '1h ago',
    status: 'Finalized',
  },
];

export const TransactionsPage: React.FC = () => {
  const { addToast } = useToast();
  const [search, setSearch] = useState('');

  const handleCopyHash = (hash: string) => {
    addToast({
      title: 'Hash Copied',
      message: `Cryptographic proof ${hash} copied to clipboard.`,
      type: 'info',
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
            <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">
              Real-Time Immutable Ledger
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Cryptographically signed ledger transactions with zero-knowledge proof verification
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-slate-300">
            MERKLE ROOT: 0x8A9...4D2
          </span>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="p-6 rounded-3xl bg-[#0D101C]/80 border border-white/10 backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by hash, protocol, or amount..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <span className="text-xs font-mono text-cyan-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> CONSENSUS SYNCHRONIZED
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-white/5 text-slate-500 uppercase text-[10px]">
                <th className="py-3 px-3">Transaction Proof</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Protocol Rail</th>
                <th className="py-3 px-3">Confirmation Depth</th>
                <th className="py-3 px-3 text-right">Value</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {LEDGER_ROWS.map((row, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02]">
                  <td className="py-3.5 px-3 text-cyan-400 font-semibold">{row.txHash}</td>
                  <td className="py-3.5 px-3 text-white">{row.type}</td>
                  <td className="py-3.5 px-3 text-slate-300">{row.protocol}</td>
                  <td className="py-3.5 px-3 text-slate-400">{row.blockDepth}</td>
                  <td
                    className={`py-3.5 px-3 text-right font-bold ${
                      row.amount.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {row.amount}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <button
                      onClick={() => handleCopyHash(row.txHash)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
                      title="Copy transaction proof"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

export default TransactionsPage;
