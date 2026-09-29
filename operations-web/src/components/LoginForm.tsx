import { FormEvent, useState } from 'react';
import { request } from '../api/client';
import type { AuthResponse, AuthUser } from '../types/api';
import { Sparkles, Mail, Lock, ShieldCheck, ArrowRight, Loader2, KeyRound, UserCheck } from 'lucide-react';

interface LoginFormProps {
  onSuccess: (auth: AuthResponse) => Promise<void>;
  onMockLogin?: (user: AuthUser, token: string) => void;
}

export function LoginForm({ onSuccess, onMockLogin }: LoginFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deviceId] = useState(() => `operations-web-${crypto.randomUUID()}`);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const authData = await request<AuthResponse>('/auth/email/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, deviceId }),
      });
      await onSuccess(authData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Không thể kết nối đến máy chủ xác thực.');
    } finally {
      setLoading(false);
    }
  }

  const handleDemoSignIn = async (role: 'ADMIN' | 'TECHNICIAN') => {
    setLoading(true);
    setError(null);
    const demoUser: AuthUser = {
      id: role === 'ADMIN' ? '00000000-0000-0000-0000-000000000001' : '00000000-0000-0000-0000-000000000002',
      email: role === 'ADMIN' ? 'admin@matxa.vn' : 'ktv@matxa.vn',
      name: role === 'ADMIN' ? 'Quản Trị Viên Trưởng' : 'KTV Thảo Mai (Chuyên gia Spa 5★)',
      role,
      status: 'ACTIVE',
    };
    const mockAuth: AuthResponse = {
      accessToken: 'demo-token-' + role.toLowerCase(),
      refreshToken: 'demo-refresh-token',
      user: demoUser,
    };

    if (onMockLogin) {
      onMockLogin(demoUser, mockAuth.accessToken);
    } else {
      await onSuccess(mockAuth);
    }
    setLoading(false);
  };

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
          <p>Hệ thống điều hành trung tâm dành cho Quản trị viên & Kỹ thuật viên Spa</p>
        </div>

        <form className="form-grid" onSubmit={submit}>
          <label>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={15} className="card-icon" /> Email quản trị
            </span>
            <input
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@matxa.vn hoặc ktv@matxa.vn"
              autoComplete="email"
            />
          </label>

          <label>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={15} className="card-icon" /> Mật khẩu
            </span>
            <input
              name="password"
              type="password"
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          <button type="submit" disabled={loading} style={{ marginTop: '8px' }}>
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Đang xác thực...
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

        <div className="quick-creds">
          <div className="quick-creds-title">
            <ShieldCheck size={16} /> Trải nghiệm nhanh chế độ Demo (1-Click):
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
            <button
              type="button"
              className="secondary"
              style={{ fontSize: '0.82rem', padding: '9px 12px' }}
              onClick={() => void handleDemoSignIn('ADMIN')}
            >
              👑 Vào vai Admin
            </button>
            <button
              type="button"
              className="secondary"
              style={{ fontSize: '0.82rem', padding: '9px 12px' }}
              onClick={() => void handleDemoSignIn('TECHNICIAN')}
            >
              💆 Vào vai KTV
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
