import React, { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpenText, EyeOff, FileUp, History, RefreshCw, Upload } from 'lucide-react';
import { request } from '../api/client';
import { PageHeader } from '../components/common/PageHeader';
import { useToast } from '../components/ui/ToastContainer';
import { useConfirm } from '../components/ui/useConfirm';
import { Badge, Button, Field, Input, Select } from '../components/ui/kit';

type Audience = 'CUSTOMER' | 'TECHNICIAN' | 'ALL';
type LegalDocument = {
  code: string;
  title: string;
  audience: Audience;
  published: boolean;
  current: { versionLabel: string; fileName: string; updatedAt: string; downloadUrl: string } | null;
  history: Array<{ version: number; versionLabel: string; fileName: string; createdAt: string }>;
};

const AUDIENCE: Record<Audience, { label: string; tone: 'blue' | 'green' | 'gray' }> = {
  ALL: { label: 'Khách & KTV', tone: 'gray' },
  CUSTOMER: { label: 'Khách hàng', tone: 'blue' },
  TECHNICIAN: { label: 'Kỹ thuật viên', tone: 'green' },
};

/** The documents the apps list today, so the admin picks one instead of typing a code. */
const PRESETS: Array<{ code: string; title: string; audience: Audience }> = [
  { code: 'TECHNICIAN_TERMS', title: 'Điều khoản dịch vụ đối với kỹ thuật viên', audience: 'TECHNICIAN' },
  { code: 'PRIVACY_POLICY', title: 'Chính sách bảo mật và bảo vệ dữ liệu cá nhân', audience: 'ALL' },
  { code: 'OPERATING_RULES', title: 'Quy chế hoạt động', audience: 'ALL' },
  { code: 'DATA_PROTECTION_AGREEMENT', title: 'Thỏa thuận bảo vệ thông tin và bảo mật dữ liệu cá nhân', audience: 'ALL' },
  { code: 'TERMS_OF_USE', title: 'Điều khoản sử dụng', audience: 'ALL' },
];
const OTHER = '__OTHER__';
const date = (value: string) => new Date(value).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function LegalDocumentsPage() {
  const { addToast } = useToast();
  const { confirm, dialog } = useConfirm();
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState(PRESETS[0].code);
  const [title, setTitle] = useState(PRESETS[0].title);
  const [audience, setAudience] = useState<Audience>(PRESETS[0].audience);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDocuments(await request<LegalDocument[]>('/admin/legal-documents'));
    } catch (error) {
      addToast({ type: 'error', title: 'Không tải được danh sách', message: error instanceof Error ? error.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [addToast]);
  useEffect(() => {
    void load();
  }, [load]);

  const choose = (code: string) => {
    setPreset(code);
    const known = PRESETS.find((item) => item.code === code) ?? documents.find((item) => item.code === code);
    if (known) {
      setTitle(known.title);
      setAudience(known.audience);
    } else {
      setTitle('');
      setAudience('ALL');
    }
  };

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return addToast({ type: 'error', title: 'Chưa chọn file PDF' });
    if (!title.trim()) return addToast({ type: 'error', title: 'Chưa nhập tên văn bản' });
    const form = new FormData();
    form.append('file', file);
    form.append('title', title.trim());
    form.append('audience', audience);
    if (preset !== OTHER) form.append('code', preset);
    setSaving(true);
    try {
      const created = await request<{ version: number }>('/admin/legal-documents/upload', { method: 'POST', body: form });
      addToast({ type: 'success', title: `Đã đăng "${title.trim()}"`, message: `Phiên bản ${created.version}.0 đang hiện trên app` });
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      await load();
    } catch (error) {
      addToast({ type: 'error', title: 'Đăng thất bại', message: error instanceof Error ? error.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const hide = async (document: LegalDocument) => {
    const ok = await confirm({
      title: `Ẩn "${document.title}"?`,
      message: 'Văn bản sẽ không còn hiện trên app. Đăng lại file sẽ hiện lại với phiên bản mới.',
      confirmText: 'Ẩn văn bản',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await request(`/admin/legal-documents/${encodeURIComponent(document.code)}`, { method: 'DELETE' });
      addToast({ type: 'success', title: 'Đã ẩn văn bản' });
      await load();
    } catch (error) {
      addToast({ type: 'error', title: 'Không ẩn được', message: error instanceof Error ? error.message : undefined });
    }
  };

  const options = [...PRESETS, ...documents.filter((doc) => !PRESETS.some((item) => item.code === doc.code))];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Điều khoản & Chính sách"
        subtitle="Các văn bản PDF hiện ở mục “Điều khoản và chính sách” trên app. Đăng lại = phiên bản mới, bản cũ được lưu lịch sử."
        icon={<BookOpenText className="w-5 h-5" />}
        actions={<Button onClick={() => void load()} loading={loading} icon={<RefreshCw className="w-4 h-4" />}>Làm mới</Button>}
      />

      <form onSubmit={upload} className="rounded-2xl border border-surface-border bg-white p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-bold text-content-primary">
          <FileUp className="w-4 h-4 text-primary" /> Đăng văn bản / phiên bản mới
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Văn bản" required>
            <Select value={preset} onChange={(event) => choose(event.target.value)}>
              {options.map((item) => (
                <option key={item.code} value={item.code}>{item.title}</option>
              ))}
              <option value={OTHER}>+ Văn bản khác…</option>
            </Select>
          </Field>
          <Field label="Hiện cho" required>
            <Select value={audience} onChange={(event) => setAudience(event.target.value as Audience)}>
              <option value="ALL">Khách hàng & Kỹ thuật viên</option>
              <option value="CUSTOMER">Chỉ khách hàng</option>
              <option value="TECHNICIAN">Chỉ kỹ thuật viên</option>
            </Select>
          </Field>
          <Field label="Tên hiển thị trên app" required className="md:col-span-2">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="vd: Chính sách hoàn tiền" maxLength={200} />
          </Field>
          <Field label="File PDF (tối đa 10MB)" required className="md:col-span-2">
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-content-secondary file:mr-3 file:px-4 file:py-2 file:rounded-xl file:border-0 file:bg-primary-soft file:text-primary file:font-semibold hover:file:bg-[#DCEFE0]"
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={saving} icon={<Upload className="w-4 h-4" />}>Đăng lên app</Button>
        </div>
      </form>

      <section className="rounded-2xl border border-surface-border bg-white">
        {loading && !documents.length ? (
          <div className="p-5 space-y-3">{[0, 1, 2].map((key) => <div key={key} className="h-16 rounded-xl bg-surface-subtle animate-pulse" />)}</div>
        ) : documents.length === 0 ? (
          <div className="py-14 text-center">
            <BookOpenText className="w-10 h-10 mx-auto text-primary" />
            <p className="mt-3 font-semibold text-content-primary">Chưa đăng văn bản nào</p>
            <p className="text-sm text-content-secondary">Chọn văn bản ở trên và tải file PDF để hiện lên app.</p>
          </div>
        ) : (
          <ul className="divide-y divide-surface-borderSubtle">
            {documents.map((document) => (
              <li key={document.code} className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-content-primary">{document.title}</span>
                      {document.current ? <Badge tone="green" dot>v{document.current.versionLabel}</Badge> : <Badge tone="gray">Đang ẩn</Badge>}
                      <Badge tone={AUDIENCE[document.audience]?.tone ?? 'gray'}>{AUDIENCE[document.audience]?.label ?? document.audience}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-content-secondary truncate">
                      {document.current ? `${document.current.fileName} · cập nhật ${date(document.current.updatedAt)}` : 'Không hiện trên app'}
                      {' · '}<span className="font-mono">{document.code}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {document.current && (
                      <a href={document.current.downloadUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-surface-border text-xs font-semibold text-content-primary hover:bg-surface-subtle">
                        Xem PDF
                      </a>
                    )}
                    <Button size="sm" variant="soft" icon={<FileUp className="w-4 h-4" />} onClick={() => { choose(document.code); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                      Phiên bản mới
                    </Button>
                    <Button size="sm" variant="ghost" icon={<History className="w-4 h-4" />} onClick={() => setOpenHistory(openHistory === document.code ? null : document.code)}>
                      Lịch sử ({document.history.length})
                    </Button>
                    {document.current && (
                      <Button size="sm" variant="danger" icon={<EyeOff className="w-4 h-4" />} onClick={() => void hide(document)}>Ẩn</Button>
                    )}
                  </div>
                </div>
                <AnimatePresence initial={false}>
                  {openHistory === document.code && (
                    <motion.ol initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-3 overflow-hidden rounded-xl bg-surface-subtle text-xs">
                      {document.history.map((item) => (
                        <li key={item.version} className="flex justify-between gap-3 px-3 py-2 border-b border-surface-border last:border-0">
                          <span className="font-semibold text-content-primary">v{item.versionLabel}</span>
                          <span className="flex-1 truncate text-content-secondary">{item.fileName}</span>
                          <span className="text-content-tertiary">{date(item.createdAt)}</span>
                        </li>
                      ))}
                    </motion.ol>
                  )}
                </AnimatePresence>
              </li>
            ))}
          </ul>
        )}
      </section>
      {dialog}
    </div>
  );
}

export default LegalDocumentsPage;
