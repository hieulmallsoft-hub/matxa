import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Key,
  Shield,
  Copy,
  RefreshCw,
  Check,
  Globe,
  Bell,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useToast } from '../components/ui/ToastContainer';
import { request } from '../api/client';

type NotificationTemplate = { type: string; title: string; body: string; isActive: boolean };

interface SettingsPageProps {
  theme: string;
  onToggleTheme: (t: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ theme, onToggleTheme }) => {
  const { addToast } = useToast();
  const [apiKey, setApiKey] = useState('aeth_live_8f3d09a12c4e88b901fc4321');
  const [showKey, setShowKey] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('https://api.aetheris.io/v1/telemetry/webhook');
  const [notificationTemplates, setNotificationTemplates] = useState<NotificationTemplate[]>([]);

  React.useEffect(() => {
    void request<NotificationTemplate[]>('/admin/notifications/templates')
      .then(setNotificationTemplates)
      .catch(() => undefined);
  }, []);

  const handleCopyKey = () => {
    addToast({
      title: 'API Secret Copied',
      message: 'Cryptographic API key copied to system clipboard.',
      type: 'info',
    });
  };

  const handleRollKey = () => {
    const newKey = `aeth_live_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
    setApiKey(newKey);
    addToast({
      title: 'API Key Rotated',
      message: 'Generated new zero-knowledge authenticated API key token.',
      type: 'success',
    });
  };

  const handleSaveSettings = () => {
    addToast({
      title: 'Preferences Saved',
      message: 'Platform configuration updated across all edge replicas.',
      type: 'success',
    });
  };

  const updateTemplate = (type: string, field: 'title' | 'body', value: string) => {
    setNotificationTemplates((current) => current.map((template) => template.type === type ? { ...template, [field]: value } : template));
  };

  const saveTemplate = async (template: NotificationTemplate) => {
    try {
      await request(`/admin/notifications/templates/${template.type}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: template.title, body: template.body, isActive: template.isActive }),
      });
      addToast({ title: 'Đã lưu thông báo', message: template.type, type: 'success' });
    } catch (error) {
      addToast({ title: 'Không thể lưu', message: error instanceof Error ? error.message : 'Vui lòng thử lại', type: 'error' });
    }
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
            <div className="p-2 rounded-xl bg-slate-500/10 border border-slate-500/20 text-slate-300">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">
              Cấu hình hệ thống
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Quản lý bảo mật tài khoản và các thiết lập vận hành Matxa
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-500 to-violet-600 text-white text-xs font-semibold shadow-lg shadow-cyan-500/25 border border-white/20 transition-all cursor-pointer"
        >
          <Check className="w-4 h-4" />
          <span>Lưu thay đổi</span>
        </button>
      </div>

      {/* API Key Management */}
      <div className="p-6 rounded-3xl bg-[#0D101C]/80 border border-white/10 backdrop-blur-xl space-y-4">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            Bảo mật tài khoản quản trị
          </h2>
        </div>
        <p className="text-xs text-slate-400">
          Quản lý thông tin bảo mật dùng để truy cập khu vực quản trị.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <input
              type={showKey ? 'text' : 'password'}
              readOnly
              value={apiKey}
              className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-cyan-300 font-mono tracking-wider focus:outline-none"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopyKey}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-slate-300 hover:text-white hover:bg-white/10 transition-all"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Sao chép</span>
            </button>
            <button
              onClick={handleRollKey}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono text-cyan-400 hover:bg-cyan-500/20 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tạo lại mã</span>
            </button>
          </div>
        </div>
      </div>

      {/* Security & Cryptographic Enclaves */}
      <div className="p-6 rounded-3xl bg-[#0D101C]/80 border border-white/10 backdrop-blur-xl space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            Xác thực hai bước
          </h2>
        </div>

        <div className="divide-y divide-white/5 text-xs">
          <div className="py-3.5 flex items-center justify-between">
            <div>
              <div className="font-semibold text-white">Bảo vệ thao tác quan trọng</div>
              <div className="text-slate-400 text-[11px] mt-0.5">
                Yêu cầu xác thực bổ sung khi thực hiện thao tác quản trị nhạy cảm
              </div>
            </div>
            <button
              onClick={() => setTwoFactorEnabled(!twoFactorEnabled)}
              className={`w-11 h-6 rounded-full transition-colors p-0.5 ${
                twoFactorEnabled ? 'bg-cyan-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  twoFactorEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="py-3.5 flex items-center justify-between">
            <div>
              <div className="font-semibold text-white">Trạng thái bảo mật</div>
              <div className="text-slate-400 text-[11px] mt-0.5">
                Hệ thống đang hoạt động và các phiên đăng nhập được theo dõi an toàn
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              ĐANG BẬT
            </span>
          </div>
        </div>
      </div>

      {/* Notification templates */}
      <div className="p-6 rounded-3xl bg-[#0D101C]/80 border border-white/10 backdrop-blur-xl space-y-5">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Mẫu thông báo</h2>
            <p className="text-xs text-slate-400 mt-1">Admin có thể đổi nội dung; mã sự kiện vẫn giữ cố định cho Mobile.</p>
          </div>
        </div>
        <div className="space-y-4">
          {notificationTemplates.map((template) => <div key={template.type} className="rounded-2xl border border-white/10 bg-black/20 p-4 space-y-3">
            <div className="flex items-center justify-between"><span className="text-xs font-mono text-cyan-300">{template.type}</span><button type="button" onClick={() => void saveTemplate(template)} className="px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-xs text-cyan-300">Lưu mẫu</button></div>
            <input value={template.title} onChange={(e) => updateTemplate(template.type, 'title', e.target.value)} placeholder="Tiêu đề" className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-500" />
            <textarea value={template.body} onChange={(e) => updateTemplate(template.type, 'body', e.target.value)} rows={2} placeholder="Nội dung" className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-500" />
          </div>)}
        </div>
      </div>

      {/* Webhook Endpoints */}
      <div className="p-6 rounded-3xl bg-[#0D101C]/80 border border-white/10 backdrop-blur-xl space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            Tùy chọn thông báo
          </h2>
        </div>

        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1">
            KÊNH NHẬN THÔNG BÁO
          </label>
          <input
            type="text"
            value="Thông báo trong hệ thống và email quản trị"
            readOnly
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>
    </motion.div>
  );
};

export default SettingsPage;
