import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, Search, CheckCircle2, Copy, FileText, Download, Clock } from 'lucide-react';
import { useToast } from '../components/ui/ToastContainer';
import { PageHeader } from '../components/common/PageHeader';
import { StatusBadge } from '../components/common/StatusBadge';

const TRANSACTION_ROWS = [
  {
    txId: 'TX-2026-10492',
    type: 'Thanh toán booking tại nhà',
    amount: '+750.000 đ',
    method: 'VietQR Napas 247',
    party: 'Khách: Nguyễn Thị Lan',
    time: '2 phút trước',
    status: 'Completed',
    isPositive: true,
  },
  {
    txId: 'TX-2026-10491',
    type: 'Giải ngân hoa hồng ca hoàn thành',
    amount: '-525.000 đ',
    method: 'Ví nội bộ KTV',
    party: 'KTV: Lê Hoàng Yến (70%)',
    time: '18 phút trước',
    status: 'Completed',
    isPositive: false,
  },
  {
    txId: 'TX-2026-10490',
    type: 'Phí vận hành & nền tảng',
    amount: '+225.000 đ',
    method: 'Hệ thống MATXXA',
    party: 'Khấu trừ tự động (30%)',
    time: '24 phút trước',
    status: 'Completed',
    isPositive: true,
  },
  {
    txId: 'TX-2026-10489',
    type: 'Hoàn tiền khách hủy ca hẹn',
    amount: '-450.000 đ',
    method: 'VietQR hoàn tiền tự động',
    party: 'Khách: Đặng Quốc Bảo',
    time: '45 phút trước',
    status: 'Pending',
    isPositive: false,
  },
  {
    txId: 'TX-2026-10488',
    type: 'KTV nạp ký quỹ đảm bảo ca',
    amount: '+2.000.000 đ',
    method: 'Chuyển khoản Vietcombank',
    party: 'KTV: Trần Đình Trọng',
    time: '1 giờ trước',
    status: 'Completed',
    isPositive: true,
  },
  {
    txId: 'TX-2026-10487',
    type: 'Thanh toán combo VIP 120 phút',
    amount: '+1.250.000 đ',
    method: 'Ví MoMo Doanh nghiệp',
    party: 'Khách: Vũ Quỳnh Trang',
    time: '2 giờ trước',
    status: 'Completed',
    isPositive: true,
  },
];

export const TransactionsPage: React.FC = () => {
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');

  const handleCopyId = (txId: string) => {
    navigator.clipboard?.writeText(txId);
    addToast({
      title: 'Đã sao chép mã',
      message: `Mã giao dịch ${txId} đã được sao chép vào bộ nhớ tạm.`,
      type: 'info',
    });
  };

  const handleExportReport = () => {
    addToast({
      title: 'Đang trích xuất sổ cái',
      message: 'Báo cáo sao kê đối soát Excel sẽ được tải xuống trong giây lát.',
      type: 'success',
    });
  };

  const filteredRows = TRANSACTION_ROWS.filter((row) => {
    const matchSearch =
      row.txId.toLowerCase().includes(search.toLowerCase()) ||
      row.party.toLowerCase().includes(search.toLowerCase()) ||
      row.type.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 pb-12"
    >
      {/* Header */}
      <PageHeader
        title="Sổ cái đối soát giao dịch"
        subtitle="Nhật ký chi tiết dòng tiền ra/vào, giải ngân hoa hồng KTV và đối soát booking thời gian thực"
        breadcrumbs={[
          { label: 'MATXXA', href: '#' },
          { label: 'Tài chính & Thanh toán', href: '#' },
          { label: 'Sổ cái đối soát' },
        ]}
        actions={
          <button
            onClick={handleExportReport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E5EBE5] bg-white hover:bg-[#F6F8F4] text-[#1C2B20] text-sm font-medium shadow-sm transition-all"
          >
            <Download className="w-4 h-4 text-[#2E7D4A]" />
            <span>Xuất sao kê Excel</span>
          </button>
        }
      />

      {/* Main Ledger Card */}
      <div className="bg-white border border-[#E5EBE5] rounded-2xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 sm:p-5 border-b border-[#E5EBE5] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#FAFCF9]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#66756B]" />
            <input
              type="text"
              placeholder="Tìm theo mã giao dịch, khách hàng, KTV..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-[#E5EBE5] rounded-xl text-[#1C2B20] placeholder-[#66756B]/60 focus:outline-none focus:border-[#2E7D4A] focus:ring-1 focus:ring-[#2E7D4A] transition-all"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-[#66756B]">
            <Clock className="w-4 h-4 text-[#2E7D4A]" />
            <span>Đồng bộ tự động mỗi 30 giây</span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F6F8F4] text-[#66756B] text-xs font-semibold uppercase tracking-wider border-b border-[#E5EBE5]">
              <tr>
                <th className="px-5 py-3.5">Mã giao dịch</th>
                <th className="px-5 py-3.5">Nội dung nghiệp vụ</th>
                <th className="px-5 py-3.5">Phương thức</th>
                <th className="px-5 py-3.5">Đối tượng</th>
                <th className="px-5 py-3.5 text-right">Số tiền</th>
                <th className="px-5 py-3.5">Thời gian</th>
                <th className="px-5 py-3.5 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EBE5]">
              {filteredRows.map((row) => (
                <tr key={row.txId} className="hover:bg-[#F6F8F4]/60 transition-colors">
                  <td className="px-5 py-4 font-mono text-xs font-semibold text-[#1C2B20]">
                    <div className="flex items-center gap-2">
                      <span>{row.txId}</span>
                      <button
                        onClick={() => handleCopyId(row.txId)}
                        className="p-1 rounded hover:bg-[#EAF5EC] text-[#66756B] hover:text-[#2E7D4A] transition-colors"
                        title="Sao chép mã giao dịch"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-medium text-[#1C2B20] text-sm">
                    {row.type}
                  </td>
                  <td className="px-5 py-4 text-xs text-[#66756B]">
                    <span className="px-2 py-1 rounded-md bg-[#F6F8F4] border border-[#E5EBE5]">
                      {row.method}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-[#1C2B20] font-medium">
                    {row.party}
                  </td>
                  <td className={`px-5 py-4 text-sm font-bold text-right font-mono ${
                    row.isPositive ? 'text-[#2E7D4A]' : 'text-[#E05B55]'
                  }`}>
                    {row.amount}
                  </td>
                  <td className="px-5 py-4 text-xs text-[#66756B] whitespace-nowrap">
                    {row.time}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
};

export default TransactionsPage;
