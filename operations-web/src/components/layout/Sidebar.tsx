import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { BrandLogo } from '../ui/kit';
import { NAV_GROUPS, matchesNav, type CountKey, type NavItem } from '../../navigation';
import type { PageId } from '../../types/dashboard';

interface SidebarProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  counts: Partial<Record<CountKey, number>>;
  healthy: boolean | null;
}

export const COLLAPSED_WIDTH = 76;
export const EXPANDED_WIDTH = 264;

function NavButton({ item, active, collapsed, count, onNavigate, onHover }: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  count?: number;
  onNavigate: (page: PageId) => void;
  onHover: (hint: { item: NavItem; top: number } | null) => void;
}) {
  const Icon = item.icon;
  const show = (event: React.SyntheticEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    onHover({ item, top: rect.top + rect.height / 2 });
  };
  return (
    <div className="relative group/nav" onMouseEnter={show} onMouseLeave={() => onHover(null)}>
      <button
        onFocus={show}
        onBlur={() => onHover(null)}
        onClick={() => onNavigate(item.id)}
        aria-current={active ? 'page' : undefined}
        className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] transition-colors duration-150 ${
          active ? 'text-content-primary font-semibold' : 'text-[#49634D] font-medium hover:text-content-primary hover:bg-[#F1F7EF]'
        } ${collapsed ? 'justify-center' : ''}`}
      >
        {active && (
          <motion.span
            layoutId="sidebar-active"
            className="absolute inset-0 rounded-xl bg-primary-soft border border-[#D0E7D5]"
            transition={{ type: 'spring', stiffness: 520, damping: 40 }}
          />
        )}
        <Icon className={`relative w-[18px] h-[18px] shrink-0 transition-transform group-hover/nav:scale-110 ${active ? 'text-primary' : 'text-[#4F8F46]'}`} />
        {!collapsed && <span className="relative flex-1 text-left truncate">{item.label}</span>}
        {count ? (
          <motion.span
            key={count}
            initial={{ scale: 0.6 }}
            animate={{ scale: 1 }}
            className={`relative min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold inline-flex items-center justify-center ${
              active ? 'bg-primary text-white' : 'bg-[#FEF0E2] text-[#B5651D]'
            } ${collapsed ? 'absolute -top-1 -right-1 min-w-[18px] h-[18px]' : ''}`}
          >
            {count > 99 ? '99+' : count}
          </motion.span>
        ) : null}
      </button>
    </div>
  );
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, isCollapsed, onToggleCollapse, counts, healthy }) => {
  const [query, setQuery] = useState('');
  const [hint, setHint] = useState<{ item: NavItem; top: number } | null>(null);
  const hintTimer = useRef<number | undefined>(undefined);
  // Small delay so sweeping the mouse down the menu does not flash cards.
  const onHover = (next: { item: NavItem; top: number } | null) => {
    window.clearTimeout(hintTimer.current);
    if (!next) return setHint(null);
    hintTimer.current = window.setTimeout(() => setHint(next), 350);
  };
  const groups = useMemo(
    () => NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => matchesNav(item, query)) })).filter((group) => group.items.length),
    [query],
  );
  const firstMatch = groups[0]?.items[0];

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="hidden md:flex flex-col h-screen fixed top-0 left-0 z-40 bg-white border-r border-surface-border shadow-[2px_0_16px_rgba(28,43,32,0.03)]"
    >
      <div className="h-[66px] flex items-center justify-between gap-2 px-4 border-b border-surface-border">
        <button onClick={() => onNavigate('dashboard')} className="flex items-center gap-3 min-w-0 bg-transparent text-left" title="Về Tổng quan">
          <motion.span
            whileHover={{ rotate: 18, scale: 1.05 }}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3C9A5E] to-primary flex items-center justify-center shrink-0 shadow-md shadow-primary/30"
          >
            <BrandLogo className="w-6 h-6 text-white" />
          </motion.span>
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} className="text-left min-w-0">
                <span className="block font-extrabold tracking-wide text-content-primary leading-tight">Psyocore</span>
                <span className="block text-[11px] text-content-secondary">Quản trị Massage & Spa</span>
              </motion.span>
            )}
          </AnimatePresence>
        </button>
        <button
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          className="p-1.5 rounded-lg text-content-tertiary hover:text-primary hover:bg-surface-subtle shrink-0"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="px-3 pt-3">
          <div className="relative">
            <Search className="w-4 h-4 text-content-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && firstMatch) {
                  onNavigate(firstMatch.id);
                  setQuery('');
                } else if (event.key === 'Escape') setQuery('');
              }}
              placeholder="Tìm chức năng..."
              aria-label="Tìm chức năng trong menu"
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-surface-subtle border border-surface-border text-xs focus:outline-none focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/15 transition"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Xóa" className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-content-tertiary hover:text-content-primary">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4" aria-label="Menu chính">
        {groups.map((group) => (
          <div key={group.title} className="space-y-0.5">
            {!isCollapsed && (
              <p className="px-3 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6E9271]">{group.title}</p>
            )}
            {group.items.map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={currentPage === item.id}
                collapsed={isCollapsed}
                count={item.count ? counts[item.count] : undefined}
                onHover={onHover}
                onNavigate={(page) => {
                  onNavigate(page);
                  setQuery('');
                }}
              />
            ))}
          </div>
        ))}
        {!groups.length && (
          <p className="px-3 py-6 text-center text-xs text-content-secondary">
            Không có chức năng khớp "{query}".
            <br />
            Thử <kbd className="px-1 rounded bg-surface-muted">Ctrl K</kbd> để tìm mọi thứ.
          </p>
        )}
      </nav>

      {/* Hover card outside the scrolling nav so it is never clipped. */}
      <AnimatePresence>
        {hint && (
          <motion.div
            key={hint.item.id}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ top: hint.top, left: (isCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH) + 8 }}
            className="fixed -translate-y-1/2 z-50 w-56 px-3 py-2 rounded-xl bg-content-primary text-white shadow-xl pointer-events-none"
          >
            <p className="text-xs font-semibold">{hint.item.label}</p>
            <p className="text-[11px] text-white/70 mt-0.5">{hint.item.description}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-3 border-t border-surface-border">
        <div
          className={`flex items-center gap-2.5 rounded-xl ${isCollapsed ? 'justify-center py-1' : 'p-2.5 bg-surface-subtle border border-surface-border'}`}
          title={healthy === false ? 'Không kết nối được máy chủ' : 'Máy chủ đang hoạt động'}
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            {healthy && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-success opacity-60" />}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${healthy === null ? 'bg-content-tertiary' : healthy ? 'bg-status-success' : 'bg-status-danger'}`} />
          </span>
          {!isCollapsed && (
            <span className="text-[11px] font-semibold text-content-primary">
              {healthy === null ? 'Đang kiểm tra máy chủ...' : healthy ? 'Máy chủ hoạt động bình thường' : 'Mất kết nối máy chủ'}
            </span>
          )}
        </div>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
