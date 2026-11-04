import React, { FormEvent, useState } from 'react';
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

export function ChangePasswordModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { addToast } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const tooShort = next.length > 0 && next.length < 8;
  const mismatch = confirm.length > 0 && confirm !== next;

  function close() {
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
    onClose();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!current || next.length < 8 || next !== confirm) {
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
    <Modal isOpen={isOpen} onClose={close} title="Đổi mật khẩu" subtitle="Dùng cho lần đăng nhập tiếp theo" maxWidth="md">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Mật khẩu hiện tại" required>
          <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} autoFocus />
        </Field>
        <Field label="Mật khẩu mới" required hint="Tối thiểu 8 ký tự" error={tooShort ? 'Mật khẩu mới cần ít nhất 8 ký tự' : null}>
          <Input type="password" autoComplete="new-password" maxLength={72} value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Nhập lại mật khẩu mới" required error={mismatch ? 'Mật khẩu nhập lại không khớp' : null}>
          <Input type="password" autoComplete="new-password" maxLength={72} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <FormError message={error} />
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={close}>Hủy</Button>
          <Button type="submit" variant="primary" loading={saving}>
            Đổi mật khẩu
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default ChangePasswordModal;
