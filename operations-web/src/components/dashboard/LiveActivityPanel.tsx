import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag,
  CreditCard,
  UserCheck,
  RotateCcw,
  Package,
  ShieldCheck,
  Radio,
  Plus,
} from 'lucide-react';
import { INITIAL_LIVE_ACTIVITY } from '../../data/mockData';
import { LiveActivityEvent } from '../../types/dashboard';

const EVENT_ICONS = {
  order: { icon: ShoppingBag, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
  payment: { icon: CreditCard, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  customer: { icon: UserCheck, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
  refund: { icon: RotateCcw, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
  inventory: { icon: Package, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  security: { icon: ShieldCheck, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
};

export const LiveActivityPanel: React.FC = () => {
  const [events, setEvents] = useState<LiveActivityEvent[]>(INITIAL_LIVE_ACTIVITY);

  // Function to simulate a live event
  const addSimulatedEvent = () => {
    const templates: Omit<LiveActivityEvent, 'id' | 'timestamp'>[] = [
      {
        type: 'order',
        title: 'New order received',
        description: `#ORD-${Math.floor(1000 + Math.random() * 9000)} • Neural Inference Core • Expedited`,
        amount: `$${(Math.floor(Math.random() * 40) * 100 + 499).toLocaleString()}.00`,
        badge: 'Automated',
      },
      {
        type: 'payment',
        title: 'Payment completed',
        description: 'USDT L2 Vault deposit confirmed on Arbitrum network',
        amount: '$2,450.00',
        badge: 'Crypto',
      },
      {
        type: 'customer',
        title: 'New customer registered',
        description: 'Nexus Capital Partners • Enterprise Dedicated Cluster',
        badge: 'Tier 1',
      },
    ];

    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    const newEvent: LiveActivityEvent = {
      ...randomTemplate,
      id: `act-${Date.now()}`,
      timestamp: 'Just now',
    };

    setEvents((prev) => [newEvent, ...prev.slice(0, 7)]);
  };

  return (
    <div className="rounded-3xl bg-[#0D101C]/85 border border-white/10 p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-[70px] pointer-events-none" />

      {/* Header with LIVE indicator */}
      <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-white tracking-wide">Live Activity</h2>

            {/* Small green LIVE indicator with subtle pulse animation */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-mono font-bold text-emerald-400 tracking-wider">
                LIVE
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1">Real-time telemetry event stream</p>
        </div>

        <button
          onClick={addSimulatedEvent}
          className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 transition-all hover:bg-cyan-500/20"
          title="Simulate incoming real-time telemetry event"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Simulate</span>
        </button>
      </div>

      {/* Events Feed */}
      <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {events.map((event) => {
            const config = EVENT_ICONS[event.type] || EVENT_ICONS.order;
            const Icon = config.icon;

            return (
              <motion.div
                key={event.id}
                layout
                initial={{ opacity: 0, y: -15, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 transition-all flex items-start gap-3.5 group cursor-pointer"
              >
                {/* Event Icon */}
                <div className={`p-2 rounded-xl border flex-shrink-0 mt-0.5 ${config.bg}`}>
                  <Icon className={`w-4 h-4 ${config.color}`} />
                </div>

                {/* Event Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-white truncate">
                      {event.title}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 flex-shrink-0">
                      {event.timestamp}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 leading-relaxed">
                    {event.description}
                  </p>

                  <div className="flex items-center gap-2 mt-2">
                    {event.badge && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-white/5 border border-white/10 text-slate-400">
                        {event.badge}
                      </span>
                    )}
                    {event.amount && (
                      <span className="text-[11px] font-mono font-semibold text-cyan-300">
                        {event.amount}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Bottom status */}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-500">
        <span className="flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" /> WEBSOCKET: CONNECTED
        </span>
        <span>BUFFER: 8 / 1000</span>
      </div>
    </div>
  );
};

export default LiveActivityPanel;
