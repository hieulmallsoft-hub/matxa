import type { ApiError } from '../types/api';

let accessToken: string | null = localStorage.getItem('matxa.operations.token');

export function setAccessToken(value: string | null) {
  accessToken = value;
  if (value) localStorage.setItem('matxa.operations.token', value);
  else localStorage.removeItem('matxa.operations.token');
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => null)) as ApiError | T | null;
  if (!response.ok) {
    const rawMessage = (body as ApiError | null)?.message;
    const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
    throw new Error(message || `Yêu cầu thất bại (${response.status})`);
  }
  return body as T;
}
