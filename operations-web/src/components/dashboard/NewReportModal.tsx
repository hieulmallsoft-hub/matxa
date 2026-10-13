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
      title="Generate Intelligence Report"
      subtitle="Export cryptographic analytics data and executive metrics"
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Report Types */}
        <div>
          <label className="block text-xs font-mono text-slate-400 mb-2 uppercase">
            Select Report Matrix
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              {
                id: 'executive',
                title: 'Executive Financial Summary',
                desc: 'Gross revenue, orders, and profit margins',
              },
              {
                id: 'regional',
                title: 'Global Telemetry & Nodes',
                desc: 'Latency, regional volume & edge routing',
              },
              {
                id: 'cohort',
                title: 'Customer Cohorts & LTV',
                desc: 'Retention curves, acquisition costs, NPS',
              },
              {
                id: 'inventory',
                title: 'Hardware & Stock Matrix',
                desc: 'DC allocation, units sold, replenishment',
              },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setReportType(item.id)}
                className={`p-3 rounded-xl text-left border transition-all ${
                  reportType === item.id
                    ? 'bg-gradient-to-br from-indigo-600/30 to-cyan-600/20 border-cyan-500/50 text-white'
                    : 'bg-white/[0.02] border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="font-semibold text-xs text-white">{item.title}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Date Scope */}
        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">
            Date Scope
          </label>
          <div className="grid grid-cols-3 gap-2 text-xs font-medium">
            {['Last 7 Days', 'Q3 2026', 'Year to Date'].map((d) => (
              <div
                key={d}
                className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 text-center text-slate-300 font-mono text-[11px]"
              >
                {d}
              </div>
            ))}
          </div>
        </div>

        {/* Format */}
        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">
            Export Format
          </label>
          <div className="flex gap-3">
            {[
              { id: 'pdf', label: 'PDF Document (.pdf)' },
              { id: 'csv', label: 'Raw Ledger (.csv)' },
              { id: 'json', label: 'JSON Telemetry (.json)' },
            ].map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setFormat(fmt.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all border ${
                  format === fmt.id
                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                    : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white text-xs font-semibold shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 border border-white/20 transition-all disabled:opacity-50"
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
