import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { HeroSection } from '../components/dashboard/HeroSection';
import { KpiGrid } from '../components/dashboard/KpiCard';
import { RevenueAnalytics } from '../components/dashboard/RevenueAnalytics';
import { SalesOverviewDonut } from '../components/dashboard/SalesOverviewDonut';
import { LiveActivityPanel } from '../components/dashboard/LiveActivityPanel';
import { RecentOrdersTable } from '../components/dashboard/RecentOrdersTable';
import { TopProductsList } from '../components/dashboard/TopProductsList';
import { CustomerAnalyticsCard } from '../components/dashboard/CustomerAnalyticsCard';
import { WorldSalesMap } from '../components/dashboard/WorldSalesMap';
import { QuickActionsFloating } from '../components/dashboard/QuickActionsFloating';
import { NewReportModal } from '../components/dashboard/NewReportModal';
import { OrderDetailsModal } from '../components/dashboard/OrderDetailsModal';
import { CreateOrderModal } from '../components/dashboard/CreateOrderModal';
import { INITIAL_KPIS } from '../data/mockData';
import { OrderItem } from '../types/dashboard';

const WELLNESS_MOMENTS = [
  { image: '/wellness/massage-treatment.jpg', title: 'Trị liệu tại nhà', subtitle: 'Chăm sóc cơ thể theo lịch hẹn' },
  { image: '/wellness/head-massage.jpg', title: 'Massage chuyên sâu', subtitle: 'Thư giãn và phục hồi năng lượng' },
  { image: '/wellness/consultation.jpg', title: 'Tư vấn liệu trình', subtitle: 'Theo dõi nhu cầu của khách hàng' },
  { image: '/wellness/spa-room.jpg', title: 'Không gian thư thái', subtitle: 'Trải nghiệm chuẩn spa tại nhà' },
];

interface DashboardPageProps {
  onTriggerAction: (actionName: string) => void;
  onOpenReportModal: () => void;
  isReportModalOpen: boolean;
  onCloseReportModal: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onTriggerAction,
  onOpenReportModal,
  isReportModalOpen,
  onCloseReportModal,
}) => {
  const [dateRange, setDateRange] = useState('Last 30 Days');
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-8 pb-16"
    >
      {/* 3. Dashboard Hero Header with 3D Canvas */}
      <HeroSection
        dateRange={dateRange}
        onSelectDateRange={setDateRange}
        onOpenNewReport={onOpenReportModal}
      />

      <section aria-label="Không gian và dịch vụ Matxa">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[#4f8f46]">Không gian dịch vụ</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-[#173624]">Trải nghiệm chăm sóc của Matxa</h2>
          </div>
          <span className="hidden rounded-full bg-[#eaf4e3] px-3 py-1.5 text-xs font-semibold text-[#2f7138] sm:block">4 điểm chạm dịch vụ</span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4">
          {WELLNESS_MOMENTS.map((moment, index) => (
            <motion.figure
              key={moment.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: index * 0.06 }}
              className="group relative m-0 min-h-40 overflow-hidden rounded-2xl border border-[#dce9d7] bg-[#173c25] shadow-[0_10px_25px_rgba(35,76,32,.10)] sm:min-h-52"
            >
              <img src={moment.image} alt={moment.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#102e1d]/90 via-[#102e1d]/10 to-transparent" />
              <figcaption className="absolute inset-x-0 bottom-0 p-3 text-white sm:p-4">
                <b className="block text-sm sm:text-base">{moment.title}</b>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-white/75 sm:text-xs">{moment.subtitle}</span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </section>

      {/* 4. 4 Premium KPI Cards with count-up, 3D tilt, and sparklines */}
      <KpiGrid metrics={INITIAL_KPIS} />

      {/* 5 & 6. Large Revenue Analytics Chart & Sales Overview Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8">
          <RevenueAnalytics />
        </div>
        <div className="lg:col-span-4">
          <SalesOverviewDonut />
        </div>
      </div>

      {/* 7 & 9. Live Activity & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-6">
          <LiveActivityPanel />
        </div>
        <div className="lg:col-span-6">
          <TopProductsList />
        </div>
      </div>

      {/* 10 & 11. Customer Analytics & World Sales Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-6">
          <CustomerAnalyticsCard />
        </div>
        <div className="lg:col-span-6">
          <WorldSalesMap />
        </div>
      </div>

      {/* 8. Recent Orders Table */}
      <RecentOrdersTable onSelectOrder={setSelectedOrder} />

      {/* 12. Floating Quick Actions Radial Speed Dial */}
      <QuickActionsFloating
        onTriggerAction={(action) => {
          if (action === 'new-report') {
            onOpenReportModal();
          } else if (action === 'create-order') {
            setIsCreateOrderOpen(true);
          } else {
            onTriggerAction(action);
          }
        }}
      />

      {/* Modals */}
      <NewReportModal isOpen={isReportModalOpen} onClose={onCloseReportModal} />

      <OrderDetailsModal
        order={selectedOrder}
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />

      <CreateOrderModal
        isOpen={isCreateOrderOpen}
        onClose={() => setIsCreateOrderOpen(false)}
      />
    </motion.div>
  );
};

export default DashboardPage;
