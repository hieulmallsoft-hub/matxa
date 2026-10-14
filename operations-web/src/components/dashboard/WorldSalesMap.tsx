import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Radio, TrendingUp, Users, ShoppingBag, DollarSign } from 'lucide-react';
import { WORLD_LOCATIONS } from '../../data/mockData';
import { WorldSalesLocation } from '../../types/dashboard';

export const WorldSalesMap: React.FC = () => {
  const [selectedLocation, setSelectedLocation] = useState<WorldSalesLocation | null>(
    WORLD_LOCATIONS[0]
  );
  const [hoveredLocation, setHoveredLocation] = useState<WorldSalesLocation | null>(null);

  const activeLoc = hoveredLocation || selectedLocation;

  return (
    <div className="rounded-3xl bg-[#001910]/90 border border-[#385723]/40 p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-[#385723]/20 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#385723]/30 border border-[#94AB71]/40 text-[#C7D9B5]">
              <Globe className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-bold text-[#FFFAF5] tracking-wide">Mạng Lưới Chi Nhánh & Khu Vực</h2>
          </div>
          <p className="text-xs text-[#C7D9B5]/80 mt-1">
            Trung tâm điều phối cơ sở chăm sóc, đặt lịch và đối tác phân phối khu vực
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#385723]/30 text-[#C7D9B5] border border-[#94AB71]/40 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#94AB71] animate-ping" />
            <span>6 KHU VỰC HOẠT ĐỘNG</span>
          </span>
        </div>
      </div>

      {/* Map Graphic Canvas */}
      <div className="relative w-full h-64 sm:h-72 rounded-2xl bg-[#001910] border border-[#385723]/30 overflow-hidden flex items-center justify-center p-4">
        {/* Subtle coordinate lines */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(199, 217, 181, 0.15) 1px, transparent 1px),
                              linear-gradient(to bottom, rgba(199, 217, 181, 0.15) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Abstract World SVG Paths */}
        <svg
          viewBox="0 0 1000 500"
          className="w-full h-full object-contain opacity-35 pointer-events-none"
        >
          {/* North America */}
          <path
            d="M150,120 Q220,100 280,140 T240,250 T180,240 T130,170 Z"
            fill="#1c3319"
            stroke="#294019"
          />
          {/* South America */}
          <path
            d="M260,280 Q320,300 300,420 T240,430 T240,320 Z"
            fill="#1c3319"
            stroke="#294019"
          />
          {/* Europe */}
          <path
            d="M480,110 Q540,100 560,160 T510,210 T460,160 Z"
            fill="#1c3319"
            stroke="#294019"
          />
          {/* Africa */}
          <path
            d="M480,220 Q560,230 550,370 T480,380 T450,260 Z"
            fill="#1c3319"
            stroke="#294019"
          />
          {/* Asia */}
          <path
            d="M580,100 Q780,100 820,240 T680,270 T570,200 Z"
            fill="#1c3319"
            stroke="#294019"
          />
          {/* Australia */}
          <path
            d="M780,340 Q880,330 870,410 T790,420 T760,360 Z"
            fill="#1c3319"
            stroke="#294019"
          />
        </svg>

        {/* Interactive Glowing Telemetry Node Pins */}
        {WORLD_LOCATIONS.map((loc) => {
          const isSelected = activeLoc?.id === loc.id;
          return (
            <div
              key={loc.id}
              style={{
                left: `${loc.coordinates[0]}%`,
                top: `${loc.coordinates[1]}%`,
              }}
              onMouseEnter={() => setHoveredLocation(loc)}
              onMouseLeave={() => setHoveredLocation(null)}
              onClick={() => setSelectedLocation(loc)}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
            >
              {/* Outer pulsing ring */}
              <div
                className={`absolute -inset-3 rounded-full transition-opacity duration-300 ${
                  isSelected ? 'bg-[#94AB71]/35 animate-ping' : 'opacity-0 group-hover:opacity-100 bg-[#94AB71]/20'
                }`}
              />

              {/* Glowing Core Pin */}
              <div
                className={`relative w-3.5 h-3.5 rounded-full border-2 transition-transform duration-200 flex items-center justify-center ${
                  isSelected
                    ? 'bg-[#94AB71] border-[#FFFAF5] scale-125 shadow-[0_0_15px_#94AB71]'
                    : 'bg-[#385723] border-[#C7D9B5]/80 group-hover:scale-110'
                }`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#FFFAF5]" />
              </div>

              {/* Mini pin label */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-mono text-[#C7D9B5]/80 group-hover:text-[#F9EDB2] transition-colors pointer-events-none">
                {loc.country}
              </div>
            </div>
          );
        })}

        {/* Floating Telemetry Tooltip Card */}
        {activeLoc && (
          <motion.div
            key={activeLoc.id}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-30 p-3.5 rounded-xl bg-[#001910]/95 border border-[#385723]/60 backdrop-blur-xl shadow-2xl max-w-xs pointer-events-none text-xs"
          >
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-[#385723]/40 mb-2">
              <div>
                <span className="font-bold text-[#FFFAF5] text-sm">{activeLoc.country}</span>
                <div className="text-[10px] text-[#F9EDB2] font-mono">{activeLoc.city}</div>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#385723]/40 text-[#C7D9B5] border border-[#94AB71]/40">
                +{activeLoc.growth}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[11px]">
              <div className="text-[#C7D9B5]/80">Doanh số:</div>
              <div className="text-[#FFFAF5] font-bold text-right">${activeLoc.revenue.toLocaleString()}</div>

              <div className="text-[#C7D9B5]/80">Lịch hoàn tất:</div>
              <div className="text-[#FFFAF5] font-bold text-right">{activeLoc.orders.toLocaleString()}</div>

              <div className="text-[#C7D9B5]/80">Khách phục vụ:</div>
              <div className="text-[#FFFAF5] font-bold text-right">{activeLoc.customers.toLocaleString()}</div>

              <div className="text-[#C7D9B5]/80">Độ trễ hệ thống:</div>
              <div className="text-[#94AB71] font-bold text-right">{activeLoc.latency}</div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Country quick-selector pills */}
      <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-[#385723]/30">
        {WORLD_LOCATIONS.map((loc) => {
          const isSelected = activeLoc?.id === loc.id;
          return (
            <button
              key={loc.id}
              onClick={() => setSelectedLocation(loc)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-[#385723]/40 text-[#FFFAF5] border border-[#94AB71]/50 shadow-sm'
                  : 'bg-[#001910] text-[#C7D9B5]/70 hover:text-[#FFFAF5] border border-[#385723]/30'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#94AB71]' : 'bg-[#385723]'}`} />
              <span>{loc.country}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default WorldSalesMap;
