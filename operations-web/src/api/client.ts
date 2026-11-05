import type { ApiError } from '../types/api';

let accessToken: string | null = localStorage.getItem('matxa.operations.token');

export function setAccessToken(value: string | null) {
  accessToken = value;
  if (value) localStorage.setItem('matxa.operations.token', value);
  else localStorage.removeItem('matxa.operations.token');
}

export const hasAccessToken = () => Boolean(accessToken);

// In-flight request count drives the global top progress bar.
let pending = 0;
const activityListeners = new Set<(pending: number) => void>();
export function onRequestActivity(listener: (pending: number) => void) {
  activityListeners.add(listener);
  return () => void activityListeners.delete(listener);
}
const setPending = (delta: number) => {
  pending = Math.max(0, pending + delta);
  activityListeners.forEach((listener) => listener(pending));
};

// Fired once per 401 so the shell can ask the admin to sign in again.
const unauthorizedListeners = new Set<() => void>();
export function onUnauthorized(listener: () => void) {
  unauthorizedListeners.add(listener);
  return () => void unauthorizedListeners.delete(listener);
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  setPending(1);
  try {
    const response = await fetch(`/api${path}`, {
      ...init,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...init.headers,
      },
    });
    if (response.status === 401 && accessToken && !path.startsWith('/auth/')) {
      unauthorizedListeners.forEach((listener) => listener());
    }
    if (response.status === 204) return undefined as T;
    const body = (await response.json().catch(() => null)) as ApiError | T | null;
    if (!response.ok) {
      const rawMessage = (body as ApiError | null)?.message;
      const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
      const detail = message || `Yêu cầu thất bại (${response.status})`;
      throw new Error(`${detail} · ${init.method || 'GET'} /api${path}`);
    }
    return body as T;
  } finally {
    setPending(-1);
  }
}

/**
 * Opens a private S3 file with a link fetched at click time: the links in page data expire after
 * 600 s, so a page left open longer would otherwise show S3's "Request has expired".
 * The tab opens synchronously so the browser does not treat it as a popup.
 */
export function openFreshLink(getUrl: () => Promise<string | null | undefined>) {
  const tab = window.open('', '_blank');
  if (tab) {
    tab.opener = null;
    tab.document.title = 'Đang mở file…';
    tab.document.body.textContent = 'Đang mở file…';
  }
  void getUrl()
    .then((url) => {
      if (!url) throw new Error('File không tồn tại');
      if (tab) tab.location.href = url;
      else window.location.href = url;
    })
    .catch((error: unknown) => {
      const message = `Không mở được file: ${error instanceof Error ? error.message : 'lỗi không xác định'}`;
      if (tab) tab.document.body.textContent = message;
      else window.alert(message);
    });
}
