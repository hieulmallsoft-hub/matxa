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
