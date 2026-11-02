import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CalendarClock, CheckCircle2, ChevronDown, LogOut, Menu, MessageCircle, Search, UserCheck } from 'lucide-react';
import { NAV_GROUPS, navItem, type CountKey } from '../../navigation';
import type { PageId } from '../../types/dashboard';

interface NavbarProps {
  currentPage: PageId;
  onOpenCommandPalette: () => void;
  onNavigate: (page: PageId) => void;
  onOpenMobileMenu: () => void;
  counts: Record<CountKey, number>;
  user: { name?: string | null; email?: string | null; role?: string } | null;
  onLogout: () => void;
}

const TASKS: Array<{ key: CountKey; page: PageId; label: string; icon: React.ReactNode }> = [
  { key: 'pendingBookings', page: 'orders', label: 'đơn đang chờ KTV nhận', icon: <CalendarClock className="w-4 h-4" /> },
  { key: 'pendingApplications', page: 'applications', label: 'hồ sơ KTV chờ duyệt', icon: <UserCheck className="w-4 h-4" /> },
  { key: 'unreadSupport', page: 'messages', label: 'tin nhắn CSKH chưa đọc', icon: <MessageCircle className="w-4 h-4" /> },
];

/** Closes a popover on outside click or Escape. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const popover = {
  initial: { opacity: 0, y: -6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -6, scale: 0.98 },
  transition: { duration: 0.16 },
};

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onOpenCommandPalette, onNavigate, onOpenMobileMenu, counts, user, onLogout }) => {
  const tasks = usePopover();
  const account = usePopover();
  const page = navItem(currentPage);
  const group = NAV_GROUPS.find((candidate) => candidate.items.some((item) => item.id === currentPage));
  const totalTasks = TASKS.reduce((sum, task) => sum + (counts[task.key] ?? 0), 0);
  const initials = (user?.name || user?.email || 'A').trim().slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 h-[66px] bg-white/85 backdrop-blur-md border-b border-surface-border px-4 sm:px-6 flex items-center gap-3">
      <button onClick={onOpenMobileMenu} className="md:hidden p-2 -ml-2 rounded-lg text-content-secondary hover:bg-surface-subtle" aria-label="Mở menu">
        <Menu className="w-5 h-5" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-content-tertiary font-medium truncate">{group?.title ?? 'MATXXA'}</p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={currentPage}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="text-sm font-bold text-content-primary truncate"
          >
            {page.label}
          </motion.p>
        </AnimatePresence>
      </div>

      <button
        onClick={onOpenCommandPalette}
        className="hidden sm:flex items-center gap-2 w-64 lg:w-80 px-3 py-2 rounded-xl bg-surface-subtle border border-surface-border text-xs text-content-tertiary hover:border-[#D0DCD1] hover:bg-white transition"
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left">Tìm trang, thao tác...</span>
        <kbd className="px-1.5 py-0.5 rounded-md bg-white border border-surface-border text-[10px] font-semibold text-content-secondary">Ctrl K</kbd>
      </button>
      <button onClick={onOpenCommandPalette} className="sm:hidden p-2 rounded-lg text-content-secondary hover:bg-surface-subtle" aria-label="Tìm kiếm">
        <Search className="w-5 h-5" />
      </button>

      <div ref={tasks.ref} className="relative">
        <button
          onClick={() => tasks.setOpen((value) => !value)}
          aria-label={`Việc cần xử lý: ${totalTasks}`}
          aria-expanded={tasks.open}
          className="relative p-2 rounded-xl text-content-secondary hover:text-primary hover:bg-surface-subtle"
        >
          <motion.span animate={totalTasks ? { rotate: [0, -12, 10, -6, 0] } : {}} transition={{ duration: 0.6, delay: 0.4 }} className="inline-flex">
            <Bell className="w-5 h-5" />
          </motion.span>
          {totalTasks > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-status-danger text-white text-[10px] font-bold inline-flex items-center justify-center ring-2 ring-white">
              {totalTasks > 99 ? '99+' : totalTasks}
            </span>
          )}
        </button>
        <AnimatePresence>
          {tasks.open && (
            <motion.div {...popover} className="absolute right-0 mt-2 w-80 rounded-2xl bg-white border border-surface-border shadow-dropdown overflow-hidden">
              <div className="px-4 py-3 border-b border-surface-borderSubtle">
                <p className="text-sm font-bold text-content-primary">Việc cần xử lý</p>
                <p className="text-[11px] text-content-secondary">Tự cập nhật mỗi phút</p>
              </div>
              {totalTasks === 0 ? (
                <div className="px-4 py-8 text-center">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-status-success" />
                  <p className="text-sm font-semibold mt-2">Không còn việc tồn đọng</p>
                </div>
              ) : (
                <ul className="p-2">
                  {TASKS.filter((task) => counts[task.key] > 0).map((task) => (
                    <li key={task.key}>
                      <button
                        onClick={() => {
                          onNavigate(task.page);
                          tasks.setOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-subtle text-left"
                      >
                        <span className="w-8 h-8 rounded-lg bg-[#FEF0E2] text-[#B5651D] flex items-center justify-center">{task.icon}</span>
                        <span className="text-sm text-content-primary">
                          <b>{counts[task.key]}</b> {task.label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div ref={account.ref} className="relative">
        <button
          onClick={() => account.setOpen((value) => !value)}
          aria-expanded={account.open}
          className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-surface-subtle"
        >
          <span className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3C9A5E] to-primary text-white text-xs font-bold flex items-center justify-center">{initials}</span>
          <span className="hidden lg:block text-left max-w-[160px]">
            <span className="block text-xs font-semibold text-content-primary truncate">{user?.name || user?.email || 'Quản trị viên'}</span>
            <span className="block text-[10px] text-content-tertiary">{user?.role === 'ADMIN' ? 'Quản trị viên' : user?.role}</span>
          </span>
          <ChevronDown className="hidden lg:block w-3.5 h-3.5 text-content-tertiary" />
        </button>
        <AnimatePresence>
          {account.open && (
            <motion.div {...popover} className="absolute right-0 mt-2 w-60 rounded-2xl bg-white border border-surface-border shadow-dropdown p-2">
              <div className="px-3 py-2">
                <p className="text-sm font-semibold text-content-primary truncate">{user?.name || 'Quản trị viên'}</p>
                <p className="text-xs text-content-secondary truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => {
                  account.setOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-status-danger hover:bg-status-dangerBg"
              >
                <LogOut className="w-4 h-4" /> Đăng xuất
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};

export default Navbar;
