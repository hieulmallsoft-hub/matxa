import React from 'react';
import { motion } from 'framer-motion';
import { Layers, TrendingUp, Star, Box, ArrowUpRight } from 'lucide-react';
import { TOP_PRODUCTS } from '../../data/mockData';

export const TopProductsList: React.FC = () => {
  const maxUnits = Math.max(...TOP_PRODUCTS.map((p) => p.unitsSold));

  return (
    <div className="rounded-3xl bg-[#001910]/90 border border-[#385723]/40 p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-[#385723]/20 rounded-full blur-[70px] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#385723]/30 border border-[#94AB71]/40 text-[#C7D9B5]">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-[#FFFAF5] tracking-wide">Liệu Trình Bán Chạy</h2>
          </div>
          <p className="text-xs text-[#C7D9B5]/80 mt-1">Gói chăm sóc trị liệu & tinh dầu hữu cơ nổi bật</p>
        </div>

        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#385723]/30 text-[#C7D9B5] border border-[#94AB71]/40">
          BẢNG XẾP HẠNG
        </span>
      </div>

      {/* Product List */}
      <div className="space-y-4">
        {TOP_PRODUCTS.map((product, idx) => {
          const progressPercent = Math.round((product.unitsSold / maxUnits) * 100);

          return (
            <div
              key={product.id}
              className="p-3.5 rounded-2xl bg-[#001910]/80 hover:bg-[#385723]/15 border border-[#385723]/30 hover:border-[#94AB71]/40 transition-all group"
            >
              <div className="flex items-center gap-3.5 mb-2.5">
                {/* Product Thumbnail */}
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-11 h-11 rounded-xl object-cover ring-1 ring-[#385723]/50 flex-shrink-0"
                />

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-[#FFFAF5] truncate group-hover:text-[#F9EDB2] transition-colors">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-[#94AB71]">
                      <TrendingUp className="w-3 h-3" />
                      <span>+{product.growth}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-[#C7D9B5]/70 font-mono mt-0.5">
                    <span>{product.category}</span>
                    <span>•</span>
                    <span className="text-[#F9EDB2] flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5 fill-current" /> {product.rating}
                    </span>
                    <span>•</span>
                    <span>{product.stock} gói khả dụng</span>
                  </div>
                </div>
              </div>

              {/* Metric stats row */}
              <div className="flex items-center justify-between text-xs font-mono mb-1.5 pt-1 border-t border-[#385723]/30">
                <span className="text-[#C7D9B5]/80 text-[11px]">
                  {product.unitsSold.toLocaleString()} lượt đặt
                </span>
                <span className="text-[#FFFAF5] font-bold">
                  ${(product.revenue / 1000).toFixed(1)}k d.thu
                </span>
              </div>

              {/* Animated Horizontal Progress Bar */}
              <div className="w-full h-1.5 bg-[#001910] rounded-full overflow-hidden p-[1px] border border-[#385723]/40">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 1.2, delay: 0.1 * idx, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-[#385723] via-[#94AB71] to-[#F9EDB2] rounded-full"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-[#385723]/30 flex items-center justify-between text-[11px] font-mono text-[#C7D9B5]/70">
        <span>TỒN KHO THẢO DƯỢC: TỐI ƯU</span>
        <span className="text-[#F9EDB2] hover:underline cursor-pointer">
          Quản lý Danh mục →
        </span>
      </div>
    </div>
  );
};

export default TopProductsList;
