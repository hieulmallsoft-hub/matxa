import React from 'react';
import { motion } from 'framer-motion';
import { Layers, TrendingUp, Star } from 'lucide-react';
import { TOP_PRODUCTS } from '../../data/mockData';

export const TopProductsList: React.FC = () => {
  const maxUnits = Math.max(...TOP_PRODUCTS.map((p) => p.unitsSold));

  return (
    <div className="rounded-2xl bg-white border border-[#E5EBE5] p-5 shadow-sm flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#EAF5EC] text-[#2E7D4A]">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-[#1C2B20]">Liệu Trình Bán Chạy Nhất</h2>
          </div>
          <p className="text-xs text-[#66756B] mt-0.5">Dịch vụ chăm sóc & trị liệu được khách yêu thích nhất</p>
        </div>

        <span className="text-xs px-2.5 py-1 rounded-full bg-[#EAF5EC] text-[#2E7D4A] font-medium border border-[#2E7D4A]/20">
          Xếp hạng tháng
        </span>
      </div>

      {/* Product List */}
      <div className="space-y-3.5">
        {TOP_PRODUCTS.map((product, idx) => {
          const progressPercent = Math.round((product.unitsSold / maxUnits) * 100);

          return (
            <div
              key={product.id}
              className="p-3 rounded-xl bg-[#F6F8F4] hover:bg-[#EAF5EC]/40 border border-[#E5EBE5] transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-10 h-10 rounded-lg object-cover ring-1 ring-[#E5EBE5] flex-shrink-0"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-[#1C2B20] truncate group-hover:text-[#2E7D4A] transition-colors">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-1 text-xs font-bold text-[#2E7D4A]">
                      <TrendingUp className="w-3 h-3" />
                      <span>+{product.growth}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-[#66756B] mt-0.5">
                    <span>{product.category}</span>
                    <span>•</span>
                    <span className="text-[#F2A93B] flex items-center gap-0.5 font-medium">
                      <Star className="w-3 h-3 fill-current" /> {product.rating}
                    </span>
                  </div>
                </div>
              </div>

              {/* Metric stats row */}
              <div className="flex items-center justify-between text-xs mb-1.5 pt-1 border-t border-[#E5EBE5]">
                <span className="text-[#66756B] text-[11px]">
                  {product.unitsSold.toLocaleString()} lượt đặt
                </span>
                <span className="text-[#1C2B20] font-bold">
                  {(product.revenue / 1000000).toFixed(1)} triệu đ
                </span>
              </div>

              {/* Animated Horizontal Progress Bar */}
              <div className="w-full h-1.5 bg-[#E5EBE5] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.8, delay: 0.05 * idx, ease: 'easeOut' }}
                  className="h-full bg-[#2E7D4A] rounded-full"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
