'use client';

import { useAuth } from './auth-store';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface FetchOptions extends RequestInit {
  json?: unknown;
}

async function refresh(): Promise<string | null> {
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { accessToken: string; expiresIn: number; principal: any };
  useAuth.getState().setAuth(data);
  return data.accessToken;
}

export async function api<T = unknown>(path: string, opts: FetchOptions = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_URL}${path}`;
  const headers = new Headers(opts.headers);
  if (opts.json !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  const token = useAuth.getState().accessToken;
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const init: RequestInit = {
    ...opts,
    headers,
    credentials: 'include',
    body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body,
  };
  let res = await fetch(url, init);
  if (res.status === 401) {
    const newToken = await refresh();
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(url, { ...init, headers });
    }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
