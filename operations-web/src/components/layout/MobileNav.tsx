import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flower2, X } from 'lucide-react';
import { NAV_GROUPS, matchesNav, type CountKey } from '../../navigation';
import type { PageId } from '../../types/dashboard';
import { SearchBox } from '../ui/kit';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  counts: Partial<Record<CountKey, number>>;
}

export const MobileNav: React.FC<MobileNavProps> = ({ isOpen, onClose, currentPage, onNavigate, counts }) => {
  const [query, setQuery] = useState('');
  const groups = useMemo(
    () => NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => matchesNav(item, query)) })).filter((group) => group.items.length),
    [query],
  );
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-content-primary/50 backdrop-blur-sm" />
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative w-[85%] max-w-[320px] h-full bg-white shadow-2xl flex flex-col"
            aria-label="Menu"
          >
            <div className="h-16 px-4 flex items-center justify-between border-b border-surface-border">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#3C9A5E] to-primary flex items-center justify-center">
                  <Flower2 className="w-5 h-5 text-white" />
                </span>
                <span className="font-extrabold text-content-primary">MATXXA</span>
              </div>
              <button onClick={onClose} aria-label="Đóng menu" className="p-2 rounded-lg text-content-secondary hover:bg-surface-subtle">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3">
              <SearchBox value={query} onChange={setQuery} placeholder="Tìm chức năng..." />
            </div>
            <nav className="flex-1 overflow-y-auto px-3 pb-6 space-y-4">
              {groups.map((group) => (
                <div key={group.title}>
                  <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6E9271]">{group.title}</p>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = item.id === currentPage;
                    const count = item.count ? counts[item.count] : 0;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onNavigate(item.id);
                          setQuery('');
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left ${active ? 'bg-primary-soft text-content-primary font-semibold' : 'text-[#49634D] hover:bg-surface-subtle'}`}
                      >
                        <Icon className={`w-[18px] h-[18px] ${active ? 'text-primary' : 'text-[#4F8F46]'}`} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm truncate">{item.label}</span>
                          <span className="block text-[11px] text-content-secondary truncate font-normal">{item.description}</span>
                        </span>
                        {count ? <span className="px-1.5 h-5 rounded-full bg-[#FEF0E2] text-[#B5651D] text-[10px] font-bold inline-flex items-center">{count}</span> : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};

export default MobileNav;
