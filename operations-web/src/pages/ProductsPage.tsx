import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Layers, Plus, Star, Box, Package, RefreshCw, ArrowUpRight } from 'lucide-react';
import { TOP_PRODUCTS } from '../data/mockData';
import { useToast } from '../components/ui/ToastContainer';

export const ProductsPage: React.FC = () => {
  const { addToast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState('All');

  const handleRestock = (productName: string) => {
    addToast({
      title: 'Restock Order Placed',
      message: `Triggered automated supply chain allocation for ${productName} (+50 units).`,
      type: 'success',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.4 }}
      className="space-y-8 pb-16"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-[#0D101C]/80 border border-white/10 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">
              Products & Inventory Matrix
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Global supply chain allocation, hardware pod telemetry, and autonomous license stock
          </p>
        </div>

        <button
          onClick={() =>
            addToast({
              title: 'New SKU Modal',
              message: 'Product SKU provisioner opened.',
              type: 'info',
            })
          }
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-semibold shadow-lg shadow-amber-500/20 border border-white/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Product SKU</span>
        </button>
      </div>

      {/* Stock Health Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Hardware SKUs', value: '48 Products', sub: 'Across 6 warehouses', color: 'text-cyan-400' },
          { label: 'Total Units Distributed', value: '14,820', sub: '+12.8% MoM growth', color: 'text-emerald-400' },
          { label: 'Inventory Capital Value', value: '$28.4M', sub: '99.4% audit match', color: 'text-amber-400' },
          { label: 'Low Stock Alerts', value: '1 Item', sub: 'Replenishment active', color: 'text-rose-400' },
        ].map((kpi, i) => (
          <div key={i} className="p-5 rounded-2xl bg-[#0E1220]/80 border border-white/10 backdrop-blur-xl">
            <span className="text-[11px] font-mono text-slate-400 uppercase">{kpi.label}</span>
            <div className={`text-2xl font-bold font-mono ${kpi.color} mt-1`}>{kpi.value}</div>
            <div className="text-[11px] text-slate-400 font-mono mt-1">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Product Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        {TOP_PRODUCTS.map((prod) => (
          <div
            key={prod.id}
            className="p-6 rounded-3xl bg-[#0D101C]/80 border border-white/10 hover:border-white/20 transition-all backdrop-blur-xl flex flex-col sm:flex-row gap-5 items-start"
          >
            <img
              src={prod.image}
              alt={prod.name}
              className="w-full sm:w-36 h-36 rounded-2xl object-cover ring-1 ring-white/10 flex-shrink-0"
            />

            <div className="flex-1 min-w-0 space-y-3 w-full">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-white">{prod.name}</h3>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">{prod.category}</div>
                </div>
                <span className="text-lg font-bold font-mono text-cyan-400">
                  ${prod.price.toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono p-3 rounded-xl bg-black/40 border border-white/5">
                <div>
                  <span className="text-slate-500 block text-[10px]">CURRENT STOCK</span>
                  <span className={`font-bold ${prod.stock < 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {prod.stock} units
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">TOTAL REVENUE</span>
                  <span className="text-white font-bold">${(prod.revenue / 1000).toFixed(1)}k</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-amber-400 flex items-center gap-1 font-mono">
                  <Star className="w-3.5 h-3.5 fill-current" /> {prod.rating} / 5.0 Rating
                </span>

                <button
                  onClick={() => handleRestock(prod.name)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-cyan-300 text-xs font-mono transition-all border border-white/10"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Order Restock</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default ProductsPage;
