import React, { ReactNode } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';

export interface SearchInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Tìm kiếm...',
  className = '',
}) => {
  return (
    <div className={`relative flex items-center min-w-[240px] max-w-sm ${className}`}>
      <Search className="w-4 h-4 text-[#94A399] absolute left-3.5 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border border-[#E5EBE5] text-xs text-[#1C2B20] placeholder-[#94A399] focus:outline-none focus:border-[#2E7D4A] focus:ring-2 focus:ring-[#2E7D4A]/10 transition-all"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 p-1 text-[#94A399] hover:text-[#1C2B20] rounded-full hover:bg-[#F6F8F4]"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

export interface FilterTabItem<T = string> {
  key: T;
  label: string;
  badge?: number | string;
}

export interface FilterTabsProps<T = string> {
  tabs: FilterTabItem<T>[];
  activeTab: T;
  onTabChange: (key: T) => void;
}

export function FilterTabs<T extends string = string>({
  tabs,
  activeTab,
  onTabChange,
}: FilterTabsProps<T>) {
  return (
    <div className="flex items-center gap-1.5 p-1 bg-[#F1F5EF] rounded-xl border border-[#E5EBE5] overflow-x-auto max-w-full scrollbar-none">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              isActive
                ? 'bg-white text-[#2E7D4A] shadow-sm'
                : 'text-[#66756B] hover:text-[#1C2B20] hover:bg-white/50'
            }`}
          >
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive
                    ? 'bg-[#EAF5EC] text-[#2E7D4A]'
                    : 'bg-[#E5EBE5] text-[#66756B]'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export interface FilterBarProps {
  children?: ReactNode;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  extraActions?: ReactNode;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  children,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  extraActions,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-[#E5EBE5] shadow-[0_2px_8px_rgba(28,43,32,0.02)]">
      <div className="flex items-center gap-3 flex-wrap flex-1">
        {onSearchChange && searchValue !== undefined && (
          <SearchInput
            value={searchValue}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
          />
        )}
        {children}
      </div>

      {extraActions && (
        <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
          {extraActions}
        </div>
      )}
    </div>
  );
};

export default FilterBar;
