import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Download, FileSpreadsheet, FileText, CheckCircle2 } from 'lucide-react';
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
        title: 'Xuất báo cáo thành công',
        message: `Đã trích xuất dữ liệu báo cáo dạng ${format.toUpperCase()} thành công.`,
        type: 'success',
      });
    }, 1000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Xuất Báo Cáo Vận Hành & Doanh Thu"
      subtitle="Tổng hợp dữ liệu doanh thu, ca massage, kỹ thuật viên và hiệu quả kinh doanh"
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Report Types */}
        <div>
          <label className="block text-xs font-semibold text-[#1C2B20] mb-2 uppercase tracking-wide">
            Chọn loại báo cáo
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                id: 'executive',
                title: 'Tổng hợp tài chính & Doanh thu',
                desc: 'Doanh số ròng, số lượt đặt và lợi nhuận gói',
              },
              {
                id: 'regional',
                title: 'Khu vực & Chi nhánh',
                desc: 'Hiệu suất vận hành từng quận và khu vực phục vụ',
              },
              {
                id: 'cohort',
                title: 'Khách hàng & Tỷ lệ quay lại',
                desc: 'Phân tích tệp khách VIP, tỷ lệ giữ chân & đánh giá',
              },
              {
                id: 'inventory',
                title: 'Vật tư & Tinh dầu Spa',
                desc: 'Mức tiêu hao nguyên liệu trị liệu cấp phát cho KTV',
              },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setReportType(item.id)}
                className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer ${
                  reportType === item.id
                    ? 'bg-[#EAF5EC] border-[#2E7D4A] text-[#1C2B20]'
                    : 'bg-white border-[#E5EBE5] text-[#66756B] hover:text-[#1C2B20] hover:bg-[#F6F8F4]'
                }`}
              >
                <div className="font-semibold text-xs text-[#1C2B20]">{item.title}</div>
                <div className="text-[11px] text-[#66756B] mt-0.5">{item.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Date Scope */}
        <div>
          <label className="block text-xs font-semibold text-[#1C2B20] mb-2 uppercase tracking-wide">
            Khoảng thời gian
          </label>
          <div className="grid grid-cols-3 gap-2.5 text-xs font-medium">
            {['7 ngày qua', 'Tháng này', 'Quý này'].map((d, i) => (
              <button
                key={d}
                type="button"
                className={`py-2 px-3 rounded-lg border text-center text-xs transition-all ${
                  i === 1
                    ? 'bg-[#EAF5EC] border-[#2E7D4A] text-[#2E7D4A] font-semibold'
                    : 'bg-white border-[#E5EBE5] text-[#66756B] hover:bg-[#F6F8F4]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Format */}
        <div>
          <label className="block text-xs font-semibold text-[#1C2B20] mb-2 uppercase tracking-wide">
            Định dạng tệp
          </label>
          <div className="flex gap-3">
            {[
              { id: 'pdf', label: 'Tài liệu PDF (.pdf)' },
              { id: 'csv', label: 'Bảng tính Excel (.xlsx)' },
              { id: 'json', label: 'Dữ liệu thô (.json)' },
            ].map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setFormat(fmt.id)}
                className={`px-3.5 py-2 rounded-xl text-xs transition-all border cursor-pointer ${
                  format === fmt.id
                    ? 'bg-[#EAF5EC] border-[#2E7D4A] text-[#2E7D4A] font-semibold'
                    : 'bg-white border-[#E5EBE5] text-[#66756B] hover:bg-[#F6F8F4]'
                }`}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-[#E5EBE5] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-[#66756B] hover:text-[#1C2B20] transition-colors cursor-pointer"
          >
            Hủy bỏ
          </button>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#2E7D4A] hover:bg-[#256A3E] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Đang xuất báo cáo...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Xuất báo cáo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default NewReportModal;
