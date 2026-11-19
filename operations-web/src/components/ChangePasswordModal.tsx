import React, { FormEvent, useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, LogOut } from 'lucide-react';
import { request } from '../api/client';
import Modal from './ui/Modal';
import { useToast } from './ui/ToastContainer';
import { Button, Field, FormError, Input } from './ui/kit';

// Backend messages are unaccented; show the admin proper Vietnamese.
const SERVER_MESSAGES: Record<string, string> = {
  'Mat khau hien tai khong dung': 'Mật khẩu hiện tại không đúng.',
  'Mat khau moi phai khac mat khau hien tai': 'Mật khẩu mới phải khác mật khẩu hiện tại.',
  'Tai khoan khong dang nhap bang mat khau': 'Tài khoản này không đăng nhập bằng mật khẩu.',
};

function readableError(error: unknown) {
  const raw = error instanceof Error ? error.message.split(' · ')[0] : '';
  return SERVER_MESSAGES[raw] ?? (raw || 'Không đổi được mật khẩu. Vui lòng thử lại.');
}

/** A password box with a show/hide eye on the right. */
function PasswordInput({ visible, onToggle, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { visible: boolean; onToggle: () => void }) {
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className="pr-11" />
      <button
        type="button"
        onClick={onToggle}
        tabIndex={-1}
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-content-tertiary hover:text-content-primary hover:bg-white transition-colors"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-2 text-xs transition-colors ${ok ? 'text-primary' : 'text-content-tertiary'}`}>
      <span
        className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${
          ok ? 'bg-primary text-white' : 'border border-surface-border bg-white'
        }`}
      >
        {ok && <Check className="w-3 h-3" strokeWidth={3} />}
      </span>
      {children}
    </li>
  );
}

export function ChangePasswordModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { addToast } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const longEnough = next.length >= 8;
  const different = next.length > 0 && next !== current;
  const matches = confirm.length > 0 && confirm === next;
  const ready = Boolean(current) && longEnough && different && matches;
  const toggle = (key: keyof typeof show) => setShow((value) => ({ ...value, [key]: !value[key] }));

  function close() {
    setCurrent('');
    setNext('');
    setConfirm('');
    setShow({ current: false, next: false, confirm: false });
    setError(null);
    onClose();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) {
      setError('Vui lòng kiểm tra lại các ô mật khẩu.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await request('/auth/password/change', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      addToast({ type: 'success', title: 'Đã đổi mật khẩu', message: 'Các thiết bị khác đã được đăng xuất.' });
      close();
    } catch (e) {
      setError(readableError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={close} title="Đổi mật khẩu" subtitle="Áp dụng từ lần đăng nhập tiếp theo" maxWidth="md">
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-primary-light border border-primary-soft">
          <span className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </span>
          <p className="text-xs leading-relaxed text-content-secondary">
            Dùng mật khẩu riêng cho tài khoản quản trị, không trùng với mật khẩu khác và không chia sẻ qua tin nhắn.
          </p>
        </div>

        <Field label="Mật khẩu hiện tại" required>
          <PasswordInput
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            visible={show.current}
            onToggle={() => toggle('current')}
            placeholder="Nhập mật khẩu đang dùng"
            autoFocus
          />
        </Field>

        <div className="h-px bg-surface-border" />

        <Field label="Mật khẩu mới" required>
          <PasswordInput
            autoComplete="new-password"
            maxLength={72}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            visible={show.next}
            onToggle={() => toggle('next')}
            placeholder="Ít nhất 8 ký tự"
          />
        </Field>
        <Field label="Nhập lại mật khẩu mới" required>
          <PasswordInput
            autoComplete="new-password"
            maxLength={72}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            visible={show.confirm}
            onToggle={() => toggle('confirm')}
            placeholder="Nhập lại đúng mật khẩu mới"
          />
        </Field>

        <ul className="space-y-1.5 p-3.5 rounded-xl bg-surface-subtle border border-surface-border">
          <Rule ok={longEnough}>Ít nhất 8 ký tự</Rule>
          <Rule ok={different}>Khác mật khẩu hiện tại</Rule>
          <Rule ok={matches}>Hai lần nhập mật khẩu mới khớp nhau</Rule>
        </ul>

        <FormError message={error} />

        <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 pt-1">
          <p className="flex items-center gap-1.5 text-[11px] text-content-tertiary sm:mr-auto">
            <LogOut className="w-3.5 h-3.5" /> Các thiết bị khác sẽ bị đăng xuất
          </p>
          <div className="flex gap-2 justify-end">
            <Button onClick={close}>Hủy</Button>
            <Button type="submit" variant="primary" loading={saving} disabled={!ready}>
              Đổi mật khẩu
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default ChangePasswordModal;
