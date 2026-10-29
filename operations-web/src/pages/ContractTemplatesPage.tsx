import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Download,
  ExternalLink,
  ShieldCheck,
  FileCheck2,
  Clock,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import { request } from '../api/client';
import { PageHeader } from '../components/common/PageHeader';
import { useToast } from '../components/ui/ToastContainer';

interface CurrentTemplate {
  templateId: string;
  fileName: string;
  downloadUrl?: string;
  expiresIn?: number;
}

export function ContractTemplatesPage() {
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentTemplate, setCurrentTemplate] = useState<CurrentTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(true);

  const fetchCurrentTemplate = async () => {
    setLoadingTemplate(true);
    try {
      const res = await request<CurrentTemplate>('/technician/contract/template');
      setCurrentTemplate(res);
    } catch {
      setCurrentTemplate(null);
    } finally {
      setLoadingTemplate(false);
    }
  };

  useEffect(() => {
    void fetchCurrentTemplate();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type !== 'application/pdf') {
        addToast({ title: 'Định dạng không hợp lệ', message: 'Vui lòng chọn tệp tin định dạng PDF (.pdf)', type: 'error' });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        addToast({ title: 'Định dạng không hợp lệ', message: 'Vui lòng chọn tệp tin định dạng PDF (.pdf)', type: 'error' });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      addToast({ title: 'Chưa chọn file', message: 'Vui lòng chọn file mẫu hợp đồng PDF để tải lên', type: 'error' });
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', selectedFile);
      await request('/admin/technician-contracts/template-upload', {
        method: 'POST',
        body: form,
      });

      addToast({
        title: 'Tải lên thành công',
        message: `Đã cập nhật mẫu hợp đồng "${selectedFile.name}" làm bản hiện hành cho KTV`,
        type: 'success',
      });

      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchCurrentTemplate();
    } catch (err) {
      addToast({
        title: 'Tải lên thất bại',
        message: err instanceof Error ? err.message : 'Không thể tải lên mẫu hợp đồng. Vui lòng kiểm tra lại.',
        type: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 pb-12 max-w-6xl mx-auto"
    >
      {/* 1. Page Header */}
      <PageHeader
        title="Mẫu hợp đồng KTV"
        subtitle="Quản lý và cập nhật tài liệu hợp đồng pháp lý để Kỹ thuật viên xem và ký điện tử trên ứng dụng di động"
        badge="Pháp chế & Hợp đồng"
        badgeTone="green"
        breadcrumbs={[
          { label: 'MATXXA' },
          { label: 'Quản lý' },
          { label: 'Mẫu hợp đồng KTV' },
        ]}
      />

      {/* 2. Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Upload Box */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl border border-[#E5EBE5] p-6 sm:p-7 shadow-[0_2px_16px_rgba(28,43,32,0.04)]">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-[#EAF5EC] border border-[#D0E7D5] flex items-center justify-center text-[#2E7D4A]">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#1C2B20]">Tải lên mẫu hợp đồng mới</h2>
                <p className="text-xs text-[#66756B] mt-0.5">
                  File tải lên sẽ tự động được đặt làm mẫu áp dụng chính thức cho toàn bộ KTV
                </p>
              </div>
            </div>

            <form onSubmit={handleUpload} className="space-y-5">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Drag and Drop Box */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
                  dragActive
                    ? 'border-[#2E7D4A] bg-[#EAF5EC]/60 scale-[0.99]'
                    : selectedFile
                    ? 'border-[#2E7D4A]/50 bg-[#F6F8F4]'
                    : 'border-[#D0DCD1] hover:border-[#2E7D4A] hover:bg-[#F6F8F4]/80'
                }`}
              >
                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform ${
                    selectedFile ? 'bg-[#EAF5EC] text-[#2E7D4A]' : 'bg-[#F1F5EF] text-[#66756B]'
                  }`}>
                    {selectedFile ? (
                      <FileCheck2 className="w-7 h-7 text-[#2E7D4A]" />
                    ) : (
                      <UploadCloud className="w-7 h-7 text-[#2E7D4A]" />
                    )}
                  </div>

                  {selectedFile ? (
                    <div>
                      <p className="text-sm font-bold text-[#1C2B20]">{selectedFile.name}</p>
                      <p className="text-xs text-[#2E7D4A] font-semibold mt-1">
                        {formatFileSize(selectedFile.size)} • Sẵn sàng tải lên
                      </p>
                      <span className="inline-block mt-2 text-[11px] text-[#66756B] underline hover:text-[#1C2B20]">
                        Nhấp để chọn file khác
                      </span>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-bold text-[#1C2B20]">
                        Kéo thả file hợp đồng PDF vào đây
                      </p>
                      <p className="text-xs text-[#66756B] mt-1">
                        hoặc <span className="text-[#2E7D4A] font-bold underline">duyệt từ máy tính</span> (chỉ chấp nhận định dạng .pdf, tối đa 20MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <button
                type="submit"
                disabled={busy || !selectedFile}
                className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                  busy || !selectedFile
                    ? 'bg-[#E5EBE5] text-[#94A399] cursor-not-allowed shadow-none'
                    : 'bg-[#2E7D4A] hover:bg-[#256A3E] text-white shadow-[#2E7D4A]/25 cursor-pointer hover:shadow-md active:scale-[0.99]'
                }`}
              >
                {busy ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Đang tải lên và cấu hình mẫu...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Lưu & Đặt làm mẫu hiện hành</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Current Template Status & Quick Guidelines */}
        <div className="lg:col-span-5 space-y-6">
          {/* Current Active Contract Template Card */}
          <div className="bg-white rounded-3xl border border-[#E5EBE5] p-6 shadow-[0_2px_16px_rgba(28,43,32,0.04)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EBE5]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#2E7D4A]" />
                <h3 className="font-bold text-sm text-[#1C2B20]">Mẫu hợp đồng đang áp dụng</h3>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#EAF5EC] text-[#2E7D4A] border border-[#D0E7D5]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2E7D4A] animate-pulse" />
                Hiện hành
              </span>
            </div>

            {loadingTemplate ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-2 text-xs text-[#94A399]">
                <div className="w-5 h-5 border-2 border-[#2E7D4A]/30 border-t-[#2E7D4A] rounded-full animate-spin" />
                <span>Đang kiểm tra mẫu hiện hành...</span>
              </div>
            ) : currentTemplate ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#F6F8F4] border border-[#E5EBE5] flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-[#E5EBE5] flex items-center justify-center flex-shrink-0 text-[#2E7D4A] shadow-2xs">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-[#1C2B20] truncate">
                      {currentTemplate.fileName || 'Hop_dong_doi_tac_KTV.pdf'}
                    </h4>
                    <p className="text-xs text-[#66756B] mt-0.5">
                      Định dạng chuẩn PDF • Hỗ trợ chữ ký điện tử
                    </p>
                  </div>
                </div>

                {currentTemplate.downloadUrl && (
                  <a
                    href={currentTemplate.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-[#E5EBE5] bg-white hover:bg-[#F6F8F4] text-xs font-bold text-[#1C2B20] transition-colors shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5 text-[#2E7D4A]" />
                    <span>Xem & Tải bản mẫu (.pdf)</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[#94A399] ml-1" />
                  </a>
                )}
              </div>
            ) : (
              <div className="p-6 text-center rounded-2xl bg-[#FDF0EF]/60 border border-[#F8D2D0] space-y-2">
                <AlertCircle className="w-8 h-8 text-[#D04A44] mx-auto" />
                <p className="font-bold text-xs text-[#D04A44]">Chưa có mẫu hợp đồng nào</p>
                <p className="text-[11px] text-[#66756B]">
                  Vui lòng tải lên file PDF hợp đồng đầu tiên để KTV có thể xem và thực hiện ký điện tử.
                </p>
              </div>
            )}
          </div>

          {/* Guidelines Card */}
          <div className="bg-[#F8FAF6] rounded-3xl border border-[#E5EBE5] p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-[#2E7D4A] uppercase tracking-wider">
              <Info className="w-4 h-4" />
              <span>Quy trình ký hợp đồng trên Mobile</span>
            </div>

            <div className="space-y-3 text-xs text-[#66756B]">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-white border border-[#D0E7D5] text-[#2E7D4A] font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
                  1
                </span>
                <p>
                  Hồ sơ ứng tuyển KTV được Admin phê duyệt chuyển sang trạng thái <strong>Đã duyệt</strong>.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-white border border-[#D0E7D5] text-[#2E7D4A] font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
                  2
                </span>
                <p>
                  KTV mở ứng dụng Mobile vào tab <strong>Hợp đồng</strong> xem nội dung chi tiết theo mẫu này.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-white border border-[#D0E7D5] text-[#2E7D4A] font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
                  3
                </span>
                <p>
                  KTV thực hiện ký tay trực tiếp trên màn hình cảm ứng điện thoại và bấm <strong>Gửi chữ ký</strong>.
                </p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-white border border-[#D0E7D5] text-[#2E7D4A] font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
                  4
                </span>
                <p>
                  Hệ thống tự động nhúng chữ ký, đóng dấu số và kích hoạt tài khoản KTV nhận đơn trên hệ thống.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
