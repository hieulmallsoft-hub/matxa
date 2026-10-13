import React from 'react';
import { motion } from 'framer-motion';
import { CreditCard, ArrowUpRight, ShieldCheck, CheckCircle2, DollarSign, Wallet, RefreshCcw } from 'lucide-react';
import { useToast } from '../components/ui/ToastContainer';

export const PaymentsPage: React.FC = () => {
  const { addToast } = useToast();

  const handleInstantPayout = () => {
    addToast({
      title: 'Instant Payout Initiated',
      message: 'Dispatched $42,850.00 to JPMorgan Chase Operating Vault.',
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
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">
              Payment Gateways & Telemetry
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-rail financial routing across Stripe, Apple Pay, SEPA, and Crypto L2 vaults
          </p>
        </div>

        <button
          onClick={handleInstantPayout}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-violet-600 text-white text-xs font-semibold shadow-lg shadow-cyan-500/25 border border-white/20 transition-all cursor-pointer"
        >
          <Wallet className="w-4 h-4" />
          <span>Initiate Instant Payout</span>
        </button>
      </div>

      {/* Gateway Balances */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl bg-gradient-to-br from-[#101528] to-[#0A0D18] border border-cyan-500/30 backdrop-blur-xl relative overflow-hidden">
          <div className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">
            Available Operating Balance
          </div>
          <div className="text-3xl font-bold font-mono text-white mt-1">$482,910.45</div>
          <div className="text-xs text-emerald-400 font-mono mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ready for immediate settlement
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-gradient-to-br from-[#12162A] to-[#0A0D18] border border-violet-500/30 backdrop-blur-xl">
          <div className="text-[11px] font-mono text-violet-400 uppercase tracking-wider">
            In-Flight Rolling Reserves
          </div>
          <div className="text-3xl font-bold font-mono text-white mt-1">$34,820.00</div>
          <div className="text-xs text-slate-400 font-mono mt-1">Releasing in 48 hours</div>
        </div>

        <div className="p-6 rounded-3xl bg-gradient-to-br from-[#12162A] to-[#0A0D18] border border-emerald-500/30 backdrop-blur-xl">
          <div className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">
            Processor Success Rate
          </div>
          <div className="text-3xl font-bold font-mono text-emerald-400 mt-1">99.84%</div>
          <div className="text-xs text-slate-400 font-mono mt-1">Zero downtime recorded this week</div>
        </div>
      </div>

      {/* Gateway Telemetry Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[
          { name: 'Stripe Global Express', fee: '1.4% + 20¢', share: '62.4%', latency: '142ms', status: 'Optimal' },
          { name: 'Apple Pay Biometric Direct', fee: '1.2%', share: '18.1%', latency: '98ms', status: 'Optimal' },
          { name: 'Arbitrum USDT L2 Vault', fee: '0.05% gas', share: '12.8%', latency: '420ms', status: 'Optimal' },
          { name: 'SEPA Instant Clearing', fee: '0.8%', share: '6.7%', latency: '210ms', status: 'Optimal' },
        ].map((gw, idx) => (
          <div key={idx} className="p-5 rounded-2xl bg-[#0D101C]/80 border border-white/10 backdrop-blur-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-white text-sm">{gw.name}</div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {gw.status}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono text-xs p-3 rounded-xl bg-black/40 border border-white/5">
              <div>
                <span className="text-slate-500 block text-[10px]">FEE TIER</span>
                <span className="text-slate-200">{gw.fee}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">VOLUME SHARE</span>
                <span className="text-cyan-400">{gw.share}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">API PING</span>
                <span className="text-white">{gw.latency}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default PaymentsPage;
