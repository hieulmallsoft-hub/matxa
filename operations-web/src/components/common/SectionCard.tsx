import React, { ReactNode } from 'react';

export interface SectionCardProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  icon,
  action,
  children,
  className = '',
  noPadding = false,
}) => {
  return (
    <div
      className={`rounded-2xl bg-white border border-[#E5EBE5] shadow-[0_2px_12px_rgba(28,43,32,0.04)] overflow-hidden ${className}`}
    >
      {(title || action) && (
        <div className="px-5 py-4 border-b border-[#E5EBE5] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {icon && <span className="text-[#2E7D4A]">{icon}</span>}
            <div>
              {title && (
                <h3 className="text-sm sm:text-base font-bold text-[#1C2B20] tracking-tight">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-[#66756B] mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}

      <div className={noPadding ? '' : 'p-5 sm:p-6'}>{children}</div>
    </div>
  );
};

export default SectionCard;
