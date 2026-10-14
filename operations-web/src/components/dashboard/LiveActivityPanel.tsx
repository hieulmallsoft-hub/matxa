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
  order: { icon: ShoppingBag, color: 'text-[#F9EDB2]', bg: 'bg-[#385723]/30 border-[#94AB71]/40' },
  payment: { icon: CreditCard, color: 'text-[#C7D9B5]', bg: 'bg-[#385723]/30 border-[#94AB71]/40' },
  customer: { icon: UserCheck, color: 'text-[#FFFAF5]', bg: 'bg-[#94AB71]/25 border-[#94AB71]/50' },
  refund: { icon: RotateCcw, color: 'text-rose-300', bg: 'bg-rose-500/15 border-rose-500/30' },
  inventory: { icon: Package, color: 'text-[#F9EDB2]', bg: 'bg-[#385723]/30 border-[#F9EDB2]/40' },
  security: { icon: ShieldCheck, color: 'text-[#C7D9B5]', bg: 'bg-[#385723]/30 border-[#94AB71]/40' },
};

export const LiveActivityPanel: React.FC = () => {
  const [events, setEvents] = useState<LiveActivityEvent[]>(INITIAL_LIVE_ACTIVITY);

  // Function to simulate a live event
  const addSimulatedEvent = () => {
    const templates: Omit<LiveActivityEvent, 'id' | 'timestamp'>[] = [
      {
        type: 'order',
        title: 'Lịch hẹn trị liệu mới',
        description: `#ORD-${Math.floor(1000 + Math.random() * 9000)} • Trị liệu Thảo dược Chuyên sâu`,
        amount: `$${(Math.floor(Math.random() * 40) * 100 + 499).toLocaleString()}.00`,
        badge: 'Tự động',
      },
      {
        type: 'payment',
        title: 'Thanh toán thành công',
        description: 'Voucher Chăm sóc Da Hoàng Gia đã xác nhận',
        amount: '$2,450.00',
        badge: 'Thẻ VIP',
      },
      {
        type: 'customer',
        title: 'Hội viên mới đăng ký',
        description: 'Khách hàng hạng Platinum • Cơ sở Thảo Điền',
        badge: 'VIP Platinum',
      },
    ];

    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    const newEvent: LiveActivityEvent = {
      ...randomTemplate,
      id: `act-${Date.now()}`,
      timestamp: 'Vừa xong',
    };

    setEvents((prev) => [newEvent, ...prev.slice(0, 7)]);
  };

  return (
    <div className="rounded-3xl bg-[#001910]/90 border border-[#385723]/40 p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-[#385723]/20 rounded-full blur-[70px] pointer-events-none" />

      {/* Header with LIVE indicator */}
      <div className="flex items-center justify-between pb-4 border-b border-[#385723]/30 mb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-[#FFFAF5] tracking-wide">Hoạt Động Trực Tiếp</h2>

            {/* Small green LIVE indicator with subtle pulse animation */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#385723]/30 border border-[#94AB71]/40">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#94AB71] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#94AB71]" />
              </span>
              <span className="text-[10px] font-mono font-bold text-[#C7D9B5] tracking-wider">
                LIVE
              </span>
            </div>
          </div>
          <p className="text-xs text-[#C7D9B5]/80 mt-1">Dòng sự kiện điều hành thời gian thực</p>
        </div>

        <button
          onClick={addSimulatedEvent}
          className="text-xs font-mono text-[#C7D9B5] hover:text-[#FFFAF5] flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#385723]/30 border border-[#94AB71]/40 transition-all hover:bg-[#385723]/50 cursor-pointer"
          title="Mô phỏng sự kiện thời gian thực"
        >
          <Plus className="w-3.5 h-3.5 text-[#F9EDB2]" />
          <span>Mô phỏng</span>
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
                className="p-3 rounded-2xl bg-[#001910]/80 hover:bg-[#385723]/15 border border-[#385723]/30 hover:border-[#94AB71]/40 transition-all flex items-start gap-3.5 group cursor-pointer"
              >
                {/* Event Icon */}
                <div className={`p-2 rounded-xl border flex-shrink-0 mt-0.5 ${config.bg}`}>
                  <Icon className={`w-4 h-4 ${config.color}`} />
                </div>

                {/* Event Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#FFFAF5] truncate">
                      {event.title}
                    </span>
                    <span className="text-[10px] font-mono text-[#94AB71] flex-shrink-0">
                      {event.timestamp}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#C7D9B5]/80 mt-0.5 line-clamp-1 leading-relaxed">
                    {event.description}
                  </p>

                  <div className="flex items-center gap-2 mt-2">
                    {event.badge && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-[#001910] border border-[#385723]/40 text-[#C7D9B5]/80">
                        {event.badge}
                      </span>
                    )}
                    {event.amount && (
                      <span className="text-[11px] font-mono font-semibold text-[#F9EDB2]">
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
      <div className="mt-4 pt-3 border-t border-[#385723]/30 flex items-center justify-between text-[11px] font-mono text-[#C7D9B5]/70">
        <span className="flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-[#94AB71] animate-pulse" /> KẾT NỐI: MÁY CHỦ SẴN SÀNG
        </span>
      </div>
    </div>
  );
};

export default LiveActivityPanel;
