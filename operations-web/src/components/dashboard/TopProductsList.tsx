import React from 'react';
import { motion } from 'framer-motion';
import { Layers, TrendingUp, Star, Box, ArrowUpRight } from 'lucide-react';
import { TOP_PRODUCTS } from '../../data/mockData';

export const TopProductsList: React.FC = () => {
  const maxUnits = Math.max(...TOP_PRODUCTS.map((p) => p.unitsSold));

  return (
    <div className="rounded-3xl bg-[#0D101C]/85 border border-white/10 p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-[70px] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-wide">Top Products</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">High-demand hardware & autonomous licenses</p>
        </div>

        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
          Q3 LEADERBOARD
        </span>
      </div>

      {/* Product List */}
      <div className="space-y-4">
        {TOP_PRODUCTS.map((product, idx) => {
          const progressPercent = Math.round((product.unitsSold / maxUnits) * 100);

          return (
            <div
              key={product.id}
              className="p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/15 transition-all group"
            >
              <div className="flex items-center gap-3.5 mb-2.5">
                {/* Product Thumbnail */}
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-11 h-11 rounded-xl object-cover ring-1 ring-white/10 flex-shrink-0"
                />

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold text-white truncate group-hover:text-cyan-300 transition-colors">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-400">
                      <TrendingUp className="w-3 h-3" />
                      <span>+{product.growth}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                    <span>{product.category}</span>
                    <span>•</span>
                    <span className="text-amber-400 flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5 fill-current" /> {product.rating}
                    </span>
                    <span>•</span>
                    <span>{product.stock} in stock</span>
                  </div>
                </div>
              </div>

              {/* Metric stats row */}
              <div className="flex items-center justify-between text-xs font-mono mb-1.5 pt-1 border-t border-white/5">
                <span className="text-slate-400 text-[11px]">
                  {product.unitsSold.toLocaleString()} units sold
                </span>
                <span className="text-white font-bold">
                  ${(product.revenue / 1000).toFixed(1)}k rev
                </span>
              </div>

              {/* Animated Horizontal Progress Bar */}
              <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden p-[1px] border border-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 1.2, delay: 0.1 * idx, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-amber-400 rounded-full"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-500">
        <span>INVENTORY HEALTH: OPTIMAL</span>
        <span className="text-cyan-400 hover:underline cursor-pointer">
          Manage Catalog →
        </span>
      </div>
    </div>
  );
};

export default TopProductsList;
