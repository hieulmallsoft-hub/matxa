import React, { forwardRef, useEffect, useId, useState } from 'react';
import { AnimatePresence, animate, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Loader2, Search, X } from 'lucide-react';

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

/* ── Motion presets ─────────────────────────────────────────────────────── */

export const EASE = [0.22, 1, 0.36, 1] as const;
export const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
};

/** Children wrapped in <RevealItem> fade up one after another. */
export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: delay } } }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  );
}

/** Counts up to `value` when it changes; renders the final value immediately for reduced motion. */
export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString('vi-VN') }: {
  value: number;
  format?: (value: number) => string;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) return setShown(value);
    const controls = animate(shown, value, { duration: 0.8, ease: EASE, onUpdate: setShown });
    return () => controls.stop();
    // Animate from whatever is on screen to the new target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);
  return <>{format(shown)}</>;
}

/* ── Buttons ────────────────────────────────────────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white shadow-sm shadow-primary/25 hover:bg-primary-hover',
  secondary: 'bg-white text-content-primary border border-surface-border hover:bg-surface-subtle hover:border-[#D0DCD1]',
  ghost: 'text-content-secondary hover:text-content-primary hover:bg-surface-subtle',
  danger: 'bg-white text-status-danger border border-[#F8D2D0] hover:bg-status-dangerBg',
  soft: 'bg-primary-soft text-primary hover:bg-[#DCEFE0]',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, children, className, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap select-none',
        'transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.97]',
        'disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm',
        buttonVariants[variant],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export const Spinner = ({ className }: { className?: string }) => (
  <Loader2 className={cx('w-4 h-4 animate-spin text-primary', className)} />
);

/* ── Form controls ──────────────────────────────────────────────────────── */

export const controlClass =
  'w-full min-w-0 px-3.5 py-2.5 rounded-xl bg-surface-subtle border border-surface-border text-sm text-content-primary ' +
  'placeholder:text-content-tertiary transition-[border-color,box-shadow,background-color] duration-150 ' +
  'hover:border-[#D0DCD1] focus:outline-none focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/15 ' +
  'disabled:opacity-60 aria-[invalid=true]:border-status-danger';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cx(controlClass, className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cx(controlClass, 'resize-y leading-relaxed', className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative min-w-0">
      <select ref={ref} className={cx(controlClass, 'appearance-none pr-9 cursor-pointer', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="w-4 h-4 text-content-tertiary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
});

/** Label + control + hint/error. The first child is linked to the label via id. */
export function Field({ label, hint, error, required, children, className }: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  children: React.ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>;
  className?: string;
}) {
  const generated = useId();
  const id = children.props.id ?? generated;
  const describedBy = error || hint ? `${id}-help` : undefined;
  return (
    <div className={cx('min-w-0 space-y-1.5', className)}>
      <label htmlFor={id} className="block text-xs font-semibold text-content-primary">
        {label}
        {required && <span className="text-status-danger ml-0.5">*</span>}
      </label>
      {React.cloneElement(children, { id, 'aria-invalid': Boolean(error) || undefined, 'aria-describedby': describedBy })}
      {(error || hint) && (
        <p id={describedBy} className={cx('text-[11px] leading-relaxed', error ? 'text-status-danger' : 'text-content-secondary')}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

export function Checkbox({ label, hint, checked, onChange, disabled }: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={cx('flex items-start gap-3 p-3 rounded-xl border border-surface-border cursor-pointer transition-colors hover:bg-surface-subtle', checked && 'bg-primary-light border-[#CFE5D4]', disabled && 'opacity-60 pointer-events-none')}>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
        <span className="w-9 h-5 rounded-full bg-[#D0DCD1] transition-colors peer-checked:bg-primary peer-focus-visible:ring-4 peer-focus-visible:ring-primary/20" />
        <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-content-primary">{label}</span>
        {hint && <span className="block text-[11px] text-content-secondary mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

/** Groups related fields under a heading; long forms become scannable steps. */
export function FormSection({ title, description, icon, children, collapsible, defaultOpen = true, className }: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const header = (
    <div className="flex items-start gap-3 text-left">
      {icon && <span className="w-8 h-8 rounded-lg bg-primary-soft text-primary flex items-center justify-center shrink-0">{icon}</span>}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-content-primary">{title}</span>
        {description && <span className="block text-xs text-content-secondary mt-0.5">{description}</span>}
      </span>
      {collapsible && (
        <ChevronDown className={cx('w-4 h-4 mt-1 text-content-tertiary transition-transform', open && 'rotate-180')} />
      )}
    </div>
  );
  return (
    <section className={cx('rounded-2xl border border-surface-border bg-white p-4 sm:p-5', className)}>
      {collapsible ? (
        <button type="button" className="w-full bg-transparent text-left" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          {header}
        </button>
      ) : (
        header
      )}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="pt-4 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export const FormGrid = ({ cols = 2, children, className }: { cols?: 1 | 2 | 3; children: React.ReactNode; className?: string }) => (
  <div className={cx('grid gap-4', cols === 2 && 'sm:grid-cols-2', cols === 3 && 'sm:grid-cols-2 lg:grid-cols-3', className)}>{children}</div>
);

/** Alert line for a form-level error, animated in so it is noticed. */
export function FormError({ message }: { message?: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.p
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0, x: [0, -4, 4, -2, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="p-3 rounded-xl bg-status-dangerBg border border-[#F8D2D0] text-[#B9403A] text-xs leading-relaxed"
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

/* ── Surfaces ───────────────────────────────────────────────────────────── */

export function Card({ title, subtitle, actions, children, className, bodyClassName }: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx('bg-white rounded-2xl border border-surface-border shadow-[0_1px_2px_rgba(28,43,32,0.04)] min-w-0', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-surface-borderSubtle">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-bold text-content-primary">{title}</h2>}
            {subtitle && <p className="text-xs text-content-secondary mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'gray';
const toneClass: Record<Tone, string> = {
  green: 'bg-status-successBg text-[#21784A] border-[#C8EED7]',
  amber: 'bg-status-warningBg text-[#A86A0C] border-[#FBE3B8]',
  red: 'bg-status-dangerBg text-[#B9403A] border-[#F8D2D0]',
  blue: 'bg-status-infoBg text-[#2970C2] border-[#CDE0F8]',
  gray: 'bg-surface-subtle text-content-secondary border-surface-border',
};

export const Badge = ({ tone = 'gray', children, dot }: { tone?: Tone; children: React.ReactNode; dot?: boolean }) => (
  <span className={cx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap', toneClass[tone])}>
    {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
    {children}
  </span>
);

/** Segmented tabs with a sliding active pill. */
export function Tabs<T extends string>({ value, onChange, items, className }: {
  value: T;
  onChange: (value: T) => void;
  items: Array<{ value: T; label: string; count?: number; icon?: React.ReactNode }>;
  className?: string;
}) {
  const group = useId();
  return (
    <div role="tablist" className={cx('inline-flex max-w-full overflow-x-auto p-1 rounded-xl bg-surface-muted border border-surface-border gap-1', className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cx('relative px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors', active ? 'text-primary' : 'text-content-secondary hover:text-content-primary')}
          >
            {active && (
              <motion.span layoutId={`tab-${group}`} className="absolute inset-0 rounded-lg bg-white shadow-sm" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {item.icon}
              {item.label}
              {item.count !== undefined && (
                <span className={cx('px-1.5 rounded-full text-[10px]', active ? 'bg-primary-soft' : 'bg-white')}>{item.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Tìm kiếm...', className, autoFocus }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={cx('relative min-w-0', className)}>
      <Search className="w-4 h-4 text-content-tertiary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cx(controlClass, 'pl-9 pr-8')}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Xóa tìm kiếm" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-content-tertiary hover:text-content-primary hover:bg-surface-muted">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/** Shimmer placeholder rows while a list loads. */
export const SkeletonRows = ({ rows = 4, className }: { rows?: number; className?: string }) => (
  <div className={cx('space-y-3', className)} aria-hidden>
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="h-14 rounded-xl skeleton-shimmer" style={{ opacity: 1 - index * 0.15 }} />
    ))}
  </div>
);

export function Empty({ icon, title, description, action }: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="py-12 px-4 text-center flex flex-col items-center">
      {icon && <div className="w-12 h-12 rounded-2xl bg-primary-soft text-primary flex items-center justify-center mb-3">{icon}</div>}
      <p className="text-sm font-semibold text-content-primary">{title}</p>
      {description && <p className="text-xs text-content-secondary mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}

/** Shown on pages whose numbers are sample data until a backend exists. */
export function DemoDataNotice({ what = 'Các số liệu trên trang này' }: { what?: string }) {
  return (
    <motion.div
      role="note"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3.5 rounded-xl bg-status-warningBg border border-[#FBE3B8] text-xs text-[#A86A0C] leading-relaxed flex gap-2"
    >
      <span className="font-bold whitespace-nowrap">Dữ liệu minh họa ·</span>
      <span>{what} là dữ liệu mẫu, chưa kết nối máy chủ. Không dùng để ra quyết định.</span>
    </motion.div>
  );
}

/**
 * Brand mark from public/logo.png used as a mask, so it takes the current text colour
 * (white on the green tile, green on light backgrounds).
 */
export function BrandLogo({ className }: { className?: string }) {
  const url = `url(${import.meta.env.BASE_URL}logo.png)`;
  return (
    <span
      role="img"
      aria-label="MATXXA"
      className={cx('inline-block bg-current shrink-0', className)}
      style={{ WebkitMaskImage: url, maskImage: url, WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center' }}
    />
  );
}
