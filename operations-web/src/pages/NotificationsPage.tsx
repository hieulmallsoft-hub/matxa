import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldAlert,
  Trash2,
  Check,
  Filter,
} from 'lucide-react';
import { INITIAL_NOTIFICATIONS } from '../data/mockData';
import { NotificationItem } from '../types/dashboard';
import { useToast } from '../components/ui/ToastContainer';

export const NotificationsPage: React.FC = () => {
  const { addToast } = useToast();
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [filterType, setFilterType] = useState<string>('all');

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    addToast({
      title: 'Alerts Acknowledged',
      message: 'All notifications marked as read.',
      type: 'info',
    });
  };

  const handleClear = () => {
    setNotifications([]);
    addToast({
      title: 'Feed Cleared',
      message: 'Archived all notification records to cold storage.',
      type: 'info',
    });
  };

  const filtered = notifications.filter((n) => {
    if (filterType === 'all') return true;
    return n.type === filterType;
  });

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
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <Bell className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">
              Telemetry Alerts & Incidents
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time security events, volume anomalies, and system health status dispatches
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Mark All Read</span>
          </button>

          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear Archive</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 text-xs font-mono">
        {[
          { key: 'all', label: 'All Alerts' },
          { key: 'info', label: 'Info & Analytics' },
          { key: 'success', label: 'Settlement Cleared' },
          { key: 'warning', label: 'Stock & Thresholds' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilterType(f.key)}
            className={`px-3 py-1.5 rounded-xl border transition-all ${
              filterType === f.key
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 font-semibold'
                : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-[#0D101C]/60 border border-white/5 text-slate-500 font-mono text-xs">
            No telemetry incidents matching selected filter. All clusters normal.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`p-5 rounded-2xl border transition-all flex items-start gap-4 ${
                !item.read
                  ? 'bg-gradient-to-r from-indigo-500/10 to-transparent border-indigo-500/30'
                  : 'bg-[#0D101C]/80 border-white/5 hover:border-white/10'
              }`}
            >
              <div className="mt-0.5">
                {item.type === 'info' && <Info className="w-5 h-5 text-cyan-400" />}
                {item.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {item.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                {item.type === 'error' && <ShieldAlert className="w-5 h-5 text-rose-400" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white text-sm">{item.title}</h3>
                  <span className="text-[11px] font-mono text-slate-500">{item.timestamp}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.message}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
};

export default NotificationsPage;
