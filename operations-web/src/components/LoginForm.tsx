import { FormEvent, useState } from 'react';
import { request } from '../api/client';
import type { AuthResponse } from '../types/api';
import { Sparkles, Mail, Lock, ArrowRight, Loader2, KeyRound } from 'lucide-react';

export function LoginForm({ onSuccess }: { onSuccess: (auth: AuthResponse) => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deviceId] = useState(() => {
    const uuid =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `operations-web-${uuid}`;
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSuccess(
        await request<AuthResponse>('/auth/email/login', {
          method: 'POST',
          body: JSON.stringify({ email, password, deviceId }),
        }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể kết nối đến máy chủ xác thực.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="login-container">
      <section className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <Sparkles size={32} />
          </div>
          <p className="eyebrow" style={{ justifyContent: 'center' }}>
            MATXA LUXURY OPERATIONS
          </p>
          <h1>Đăng nhập Quản trị</h1>
          <p>Hệ thống điều hành trung tâm dành cho Quản trị viên.</p>
        </div>
        <form className="form-grid" onSubmit={submit}>
          <label>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={15} className="card-icon" />
              Email quản trị
            </span>
            <input
              name="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@matxa.local"
              autoComplete="email"
            />
          </label>
          <label>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={15} className="card-icon" />
              Mật khẩu
            </span>
            <input
              name="password"
              type="password"
              minLength={6}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button type="submit" disabled={loading} style={{ marginTop: '8px' }}>
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Đang xác thực...
              </>
            ) : (
              <>
                Đăng nhập hệ thống <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
        {error && (
          <div className="form-error">
            <KeyRound size={16} />
            <span>{error}</span>
          </div>
        )}
      </section>
    </div>
  );
}
