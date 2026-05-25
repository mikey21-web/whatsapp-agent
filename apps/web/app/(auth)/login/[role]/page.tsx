'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import type { Principal } from '@diyaa/types';

const ROLE_PATHS: Record<string, { path: string; label: string; landing: string }> = {
  superadmin: { path: '/auth/superadmin/login', label: 'Super Admin', landing: '/superadmin' },
  agency: { path: '/auth/agency/login', label: 'Agency', landing: '/agency' },
  client: { path: '/auth/client/login', label: 'Client', landing: '/dashboard' },
  team: { path: '/auth/team/login', label: 'Team Member', landing: '/dashboard' },
};

interface LoginResponse {
  accessToken?: string;
  expiresIn?: number;
  principal?: Principal;
  mfaRequired?: true;
  challenge?: string;
}

export default function LoginPage() {
  const params = useParams<{ role: string }>();
  const router = useRouter();
  const cfg = ROLE_PATHS[params.role] ?? ROLE_PATHS.team;
  const setAuth = useAuth((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const r = await api<LoginResponse>(cfg.path, {
        method: 'POST',
        json: { email, password },
      });
      if (r.mfaRequired && r.challenge) {
        router.push(
          `/mfa?challenge=${encodeURIComponent(r.challenge)}&next=${encodeURIComponent(cfg.landing)}`,
        );
        return;
      }
      if (r.accessToken && r.principal && typeof r.expiresIn === 'number') {
        setAuth({ accessToken: r.accessToken, expiresIn: r.expiresIn, principal: r.principal });
        router.push(cfg.landing);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg border border-border p-6">
        <h1 className="text-xl font-semibold">{cfg.label} Login</h1>
        <Input type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Signing in...' : 'Sign in'}
        </Button>
        <div className="text-center text-xs text-muted-foreground">
          <Link href="/forgot-password" className="underline">
            Forgot password?
          </Link>
        </div>
      </form>
    </main>
  );
}
