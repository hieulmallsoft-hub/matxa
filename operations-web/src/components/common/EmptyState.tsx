import React, { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  actionIcon?: ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
  actionIcon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl bg-[#F6F8F4]/60 border border-dashed border-[#D0DCD1] max-w-lg mx-auto my-6">
      <div className="w-14 h-14 rounded-2xl bg-white border border-[#E5EBE5] text-[#2E7D4A] shadow-sm flex items-center justify-center mb-4">
        {icon || <Sparkles className="w-6 h-6 text-[#2E7D4A]" />}
      </div>
      <h3 className="text-base font-bold text-[#1C2B20] tracking-tight">{title}</h3>
      <p className="text-xs sm:text-sm text-[#66756B] mt-1.5 max-w-sm leading-relaxed">
        {description}
      </p>

      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white text-xs font-semibold shadow-sm shadow-[#2E7D4A]/25 transition-all cursor-pointer"
        >
          {actionIcon}
          <span>{actionText}</span>
        </button>
      )}
    </div>
  );
};

export default EmptyState;
