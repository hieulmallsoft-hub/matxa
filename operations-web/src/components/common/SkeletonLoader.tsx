import React from 'react';

export const SkeletonCard: React.FC<{ count?: number }> = ({ count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="p-5 rounded-2xl bg-white border border-[#E5EBE5] animate-pulse space-y-3"
        >
          <div className="flex justify-between items-center">
            <div className="h-3.5 bg-[#E5EBE5] rounded w-28" />
            <div className="w-10 h-10 rounded-xl bg-[#E5EBE5]" />
          </div>
          <div className="h-7 bg-[#E5EBE5] rounded w-36 mt-2" />
          <div className="h-3 bg-[#E5EBE5] rounded w-20 pt-2" />
        </div>
      ))}
    </>
  );
};

export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 5,
}) => {
  return (
    <div className="w-full bg-white rounded-2xl border border-[#E5EBE5] overflow-hidden p-4 space-y-3 animate-pulse">
      <div className="h-10 bg-[#F6F8F4] rounded-xl flex items-center px-4 gap-4">
        {Array.from({ length: cols }).map((_, idx) => (
          <div key={idx} className="h-3.5 bg-[#E5EBE5] rounded flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="h-14 border-b border-[#F6F8F4] flex items-center px-4 gap-4">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <div
              key={cIdx}
              className={`h-3 bg-[#E5EBE5] rounded ${
                cIdx === 0 ? 'w-10' : cIdx === 1 ? 'flex-[1.5]' : 'flex-1'
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export const SkeletonDetail: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse p-4">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[#E5EBE5]" />
        <div className="space-y-2 flex-1">
          <div className="h-5 bg-[#E5EBE5] rounded w-48" />
          <div className="h-3.5 bg-[#E5EBE5] rounded w-32" />
        </div>
      </div>
      <div className="space-y-3 pt-4 border-t border-[#E5EBE5]">
        <div className="h-4 bg-[#E5EBE5] rounded w-24" />
        <div className="h-12 bg-[#F6F8F4] rounded-xl" />
        <div className="h-12 bg-[#F6F8F4] rounded-xl" />
      </div>
    </div>
  );
};

export default {
  SkeletonCard,
  SkeletonTable,
  SkeletonDetail,
};
