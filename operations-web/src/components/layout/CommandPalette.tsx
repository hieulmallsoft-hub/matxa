import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CornerDownLeft, MessageCirclePlus, Plus, Search, Sparkles, Store } from 'lucide-react';
import { NAV_ITEMS, normalizeSearch } from '../../navigation';
import type { PageId } from '../../types/dashboard';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: PageId) => void;
}

interface PaletteItem {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  category: 'Trang' | 'Thao tác nhanh';
  page: PageId;
  search: string;
}

const QUICK_ACTIONS: Array<Omit<PaletteItem, 'search' | 'category'>> = [
  { id: 'act-promo', title: 'Tạo mã khuyến mãi', subtitle: 'Mở form tạo voucher', icon: <Sparkles className="w-4 h-4 text-status-warning" />, page: 'promotions' },
  { id: 'act-venue', title: 'Thêm địa điểm / spa', subtitle: 'Mở form thêm địa điểm', icon: <Store className="w-4 h-4 text-primary" />, page: 'venues' },
  { id: 'act-service', title: 'Thêm dịch vụ', subtitle: 'Mở danh mục dịch vụ', icon: <Plus className="w-4 h-4 text-primary" />, page: 'catalog' },
  { id: 'act-chat', title: 'Nhắn tin hỗ trợ khách', subtitle: 'Mở hộp thư CSKH', icon: <MessageCirclePlus className="w-4 h-4 text-status-info" />, page: 'messages' },
];

const ITEMS: PaletteItem[] = [
  ...NAV_ITEMS.map((item) => {
    const Icon = item.icon;
    return {
      id: `nav-${item.id}`,
      title: item.label,
      subtitle: item.description,
      icon: <Icon className="w-4 h-4 text-primary" />,
      category: 'Trang' as const,
      page: item.id,
      search: normalizeSearch(`${item.label} ${item.description} ${item.keywords ?? ''}`),
    };
  }),
  ...QUICK_ACTIONS.map((action) => ({
    ...action,
    category: 'Thao tác nhanh' as const,
    search: normalizeSearch(`${action.title} ${action.subtitle}`),
  })),
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const needle = normalizeSearch(query);
    return needle ? ITEMS.filter((item) => item.search.includes(needle)) : ITEMS;
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setSelected(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const run = (item?: PaletteItem) => {
    if (!item) return;
    onNavigate(item.page);
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
    else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelected((index) => (index + 1) % Math.max(filtered.length, 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelected((index) => (index - 1 + filtered.length) % Math.max(filtered.length, 1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(filtered[selected]);
    }
  };

  let lastCategory = '';
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh] p-4" onKeyDown={onKeyDown}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-content-primary/40 backdrop-blur-sm" />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Tìm nhanh"
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ type: 'spring', damping: 28, stiffness: 380 }}
            className="relative w-full max-w-xl bg-white rounded-2xl border border-surface-border shadow-modal overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 border-b border-surface-border">
              <Search className="w-5 h-5 text-content-tertiary" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelected(0);
                }}
                placeholder="Tìm trang hoặc thao tác (gõ không dấu cũng được)..."
                className="w-full py-4 bg-transparent text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none"
              />
              <kbd className="text-[10px] px-2 py-0.5 rounded-md bg-surface-subtle text-content-secondary border border-surface-border">Esc</kbd>
            </div>
            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
              {!filtered.length && <p className="p-8 text-center text-xs text-content-tertiary">Không có kết quả cho "{query}"</p>}
              {filtered.map((item, index) => {
                const header = item.category !== lastCategory ? item.category : null;
                lastCategory = item.category;
                const active = index === selected;
                return (
                  <React.Fragment key={item.id}>
                    {header && <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-content-tertiary">{header}</p>}
                    <button
                      data-index={index}
                      onClick={() => run(item)}
                      onMouseMove={() => setSelected(index)}
                      className={`relative w-full flex items-center gap-3 p-2.5 rounded-xl text-left ${active ? 'text-content-primary' : 'text-content-primary'}`}
                    >
                      {active && <motion.span layoutId="palette-active" className="absolute inset-0 rounded-xl bg-primary-soft" transition={{ type: 'spring', stiffness: 600, damping: 40 }} />}
                      <span className="relative w-8 h-8 rounded-lg bg-white border border-surface-border flex items-center justify-center shrink-0">{item.icon}</span>
                      <span className="relative min-w-0 flex-1">
                        <span className="block text-sm font-semibold truncate">{item.title}</span>
                        <span className="block text-[11px] text-content-secondary truncate">{item.subtitle}</span>
                      </span>
                      {active ? <CornerDownLeft className="relative w-4 h-4 text-primary" /> : <ArrowRight className="relative w-3.5 h-3.5 text-content-tertiary" />}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
            <div className="px-4 py-2 border-t border-surface-borderSubtle text-[11px] text-content-tertiary flex gap-4">
              <span>↑↓ di chuyển</span>
              <span>Enter mở</span>
              <span>Esc đóng</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;
