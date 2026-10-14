import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { FileText, Download, Check, Sparkles, Calendar, Layers, ShieldCheck } from 'lucide-react';
import { useToast } from '../ui/ToastContainer';

interface NewReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewReportModal: React.FC<NewReportModalProps> = ({ isOpen, onClose }) => {
  const { addToast } = useToast();
  const [reportType, setReportType] = useState('executive');
  const [format, setFormat] = useState('pdf');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      onClose();
      addToast({
        title: 'Report Generated Successfully',
        message: `Compiled ${reportType.toUpperCase()} intelligence bundle into .${format.toUpperCase()}`,
        type: 'success',
      });
    }, 1200);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Xuất Báo Cáo Điều Hành Vận Hành"
      subtitle="Tổng hợp dữ liệu doanh thu, kỹ thuật viên và liệu trình spa"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Report Types */}
        <div>
          <label className="block text-xs font-mono text-[#C7D9B5] mb-2 uppercase">
            Chọn Loại Báo Cáo
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              {
                id: 'executive',
                title: 'Tổng Hợp Tài Chính & Doanh Thu',
                desc: 'Doanh số ròng, số lượt đặt và lợi nhuận gói',
              },
              {
                id: 'regional',
                title: 'Mạng Lưới Chi Nhánh & Khu Vực',
                desc: 'Hiệu suất vận hành từng cơ sở và chi nhánh',
              },
              {
                id: 'cohort',
                title: 'Hội Viên & Tỷ Lệ Quay Lại',
                desc: 'Phân tích tệp khách VIP, tỷ lệ giữ chân & NPS',
              },
              {
                id: 'inventory',
                title: 'Dược Liệu & Vật Tư Spa',
                desc: 'Mức tiêu hao tinh dầu, thảo dược và bù đắp kho',
              },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setReportType(item.id)}
                className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                  reportType === item.id
                    ? 'bg-[#385723]/35 border-[#94AB71]/60 text-[#FFFAF5]'
                    : 'bg-[#001910] border-[#385723]/40 text-[#C7D9B5]/70 hover:text-[#FFFAF5] hover:bg-[#385723]/15'
                }`}
              >
                <div className="font-semibold text-xs text-[#FFFAF5]">{item.title}</div>
                <div className="text-[11px] text-[#C7D9B5]/80 mt-0.5">{item.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Date Scope */}
        <div>
          <label className="block text-xs font-mono text-[#C7D9B5] mb-1.5 uppercase">
            Khoảng Thời Gian
          </label>
          <div className="grid grid-cols-3 gap-2 text-xs font-medium">
            {['7 Ngày Qua', 'Quý Này', 'Từ Đầu Năm'].map((d) => (
              <div
                key={d}
                className="p-2.5 rounded-xl bg-[#001910] border border-[#385723]/40 text-center text-[#C7D9B5] font-mono text-[11px]"
              >
                {d}
              </div>
            ))}
          </div>
        </div>

        {/* Format */}
        <div>
          <label className="block text-xs font-mono text-[#C7D9B5] mb-1.5 uppercase">
            Định Dạng Xuất
          </label>
          <div className="flex gap-3">
            {[
              { id: 'pdf', label: 'Tài liệu PDF (.pdf)' },
              { id: 'csv', label: 'Bảng tính Excel (.csv)' },
              { id: 'json', label: 'Dữ liệu JSON (.json)' },
            ].map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setFormat(fmt.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all border cursor-pointer ${
                  format === fmt.id
                    ? 'bg-[#385723]/40 border-[#94AB71]/60 text-[#FFFAF5] font-semibold'
                    : 'bg-[#001910] border-[#385723]/30 text-[#C7D9B5]/70 hover:text-[#FFFAF5]'
                }`}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-3 border-t border-[#385723]/30 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-[#C7D9B5]/80 hover:text-[#FFFAF5] transition-colors cursor-pointer"
          >
            Hủy
          </button>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#385723] via-[#4d7530] to-[#94AB71] text-[#FFFAF5] text-xs font-semibold shadow-lg shadow-[#385723]/40 border border-[#F9EDB2]/30 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Compiling Bundle...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Export Report</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default NewReportModal;
