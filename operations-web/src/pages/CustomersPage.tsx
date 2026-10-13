import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, UserPlus, Search, Mail, Shield, Star, DollarSign, ArrowUpRight } from 'lucide-react';
import { useToast } from '../components/ui/ToastContainer';

const CUSTOMER_ENTITIES = [
  {
    id: 'CUST-1049',
    name: 'Dr. Sarah Chen',
    company: 'Quantum Lab Robotics',
    email: 's.chen@quantumlab.io',
    tier: 'Enterprise VIP',
    spent: '$48,290',
    orders: 14,
    status: 'Active',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: 'CUST-1048',
    name: 'Marcus Vance',
    company: 'Vanguard AI Security',
    email: 'm.vance@vanguard-ai.com',
    tier: 'Enterprise VIP',
    spent: '$32,150',
    orders: 9,
    status: 'Active',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: 'CUST-1047',
    name: 'Aiko Tanaka',
    company: 'Shibuya Autonomous Tech',
    email: 'aiko@shibuya-robotics.jp',
    tier: 'Growth Tier',
    spent: '$19,840',
    orders: 6,
    status: 'Active',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: 'CUST-1046',
    name: 'Julian Sterling',
    company: 'Apex Quant Partners',
    email: 'j.sterling@apexpartners.ch',
    tier: 'Enterprise VIP',
    spent: '$64,100',
    orders: 22,
    status: 'Active',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
  },
  {
    id: 'CUST-1045',
    name: 'Maya Lin',
    company: 'Prism Creative Edge',
    email: 'maya@prism-studios.co',
    tier: 'Standard',
    spent: '$4,890',
    orders: 3,
    status: 'Active',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
  },
];

export const CustomersPage: React.FC = () => {
  const { addToast } = useToast();
  const [search, setSearch] = useState('');

  const filtered = CUSTOMER_ENTITIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.company.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

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
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">
              Customer Directory
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Global high-net-worth client accounts, lifetime values, and dedicated tier privileges
          </p>
        </div>

        <button
          onClick={() =>
            addToast({
              title: 'Customer Invitation Sent',
              message: 'Generated single-use quantum onboarding link.',
              type: 'success',
            })
          }
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 border border-white/20 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Add Customer</span>
        </button>
      </div>

      {/* Customer Stat Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Accounts', value: '24,892', sub: '+18.7% this month', color: 'text-cyan-400' },
          { label: 'Average LTV', value: '$1,480.00', sub: '+12.4% expansion', color: 'text-emerald-400' },
          { label: 'VIP Enterprise Seats', value: '1,420', sub: '99.2% renewal rate', color: 'text-violet-400' },
          { label: 'Net Promoter Score', value: '78 / 100', sub: 'Global 99th percentile', color: 'text-amber-400' },
        ].map((kpi, i) => (
          <div key={i} className="p-5 rounded-2xl bg-[#0E1220]/80 border border-white/10 backdrop-blur-xl">
            <span className="text-[11px] font-mono text-slate-400 uppercase">{kpi.label}</span>
            <div className={`text-2xl font-bold font-mono ${kpi.color} mt-1`}>{kpi.value}</div>
            <div className="text-[11px] text-slate-400 font-mono mt-1">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Search Bar */}
      <div className="p-4 rounded-2xl bg-[#0D101C]/80 border border-white/10 flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client entity by name, company, or email..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <span className="text-xs font-mono text-slate-400 hidden sm:block">
          Showing {filtered.length} client entities
        </span>
      </div>

      {/* Customer Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((customer) => (
          <div
            key={customer.id}
            className="p-5 rounded-2xl bg-[#0D101C]/80 border border-white/10 hover:border-white/20 transition-all backdrop-blur-xl space-y-4 group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={customer.avatar}
                  alt={customer.name}
                  className="w-12 h-12 rounded-2xl object-cover ring-1 ring-white/10"
                />
                <div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
                    {customer.name}
                  </h3>
                  <div className="text-xs text-slate-400">{customer.company}</div>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/10 text-cyan-300 border border-indigo-500/30">
                {customer.tier}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1.5 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[11px]">Lifetime Spend:</span>
                <span className="text-white font-bold">{customer.spent}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[11px]">Orders Fulfilled:</span>
                <span className="text-cyan-400">{customer.orders} orders</span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-500 font-mono">{customer.email}</span>
              <button
                onClick={() =>
                  addToast({
                    title: 'Message Thread Opened',
                    message: `Connecting to encrypted chat with ${customer.name}`,
                    type: 'info',
                  })
                }
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-400 transition-colors"
                title="Send secure dispatch"
              >
                <Mail className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default CustomersPage;
