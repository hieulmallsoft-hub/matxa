import React, { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeTone?: 'green' | 'amber' | 'blue';
  icon?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: { label: string; onClick?: () => void; href?: string }[];
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  badgeTone = 'green',
  icon,
  actions,
  breadcrumbs,
}) => {
  const badgeColors = {
    green: 'bg-[#EAF5EC] text-[#2E7D4A] border-[#D0E7D5]',
    amber: 'bg-[#FEF6E9] text-[#B87A14] border-[#FBE3B8]',
    blue: 'bg-[#EDF4FC] text-[#2970C2] border-[#CDE0F8]',
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E5EBE5]">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-xs text-[#66756B] mb-2 font-medium">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-[#94A399]" />}
                {crumb.onClick ? (
                  <button
                    onClick={crumb.onClick}
                    className="hover:text-[#2E7D4A] transition-colors cursor-pointer"
                  >
                    {crumb.label}
                  </button>
                ) : crumb.href ? (
                  <a
                    href={crumb.href}
                    onClick={(e) => {
                      if (crumb.href === '#') e.preventDefault();
                    }}
                    className="hover:text-[#2E7D4A] transition-colors"
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span className={idx === breadcrumbs.length - 1 ? 'text-[#1C2B20] font-semibold' : ''}>
                    {crumb.label}
                  </span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3">
          {icon && (
            <div className="w-10 h-10 rounded-xl bg-[#EAF5EC] text-[#2E7D4A] flex items-center justify-center flex-shrink-0 shadow-sm border border-[#D0E7D5]">
              {icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl sm:text-[28px] font-bold text-[#1C2B20] tracking-tight">
                {title}
              </h1>
              {badge && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeColors[badgeTone]}`}
                >
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs sm:text-sm text-[#66756B] mt-1 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
