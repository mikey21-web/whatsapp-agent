'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import type { Principal } from '@diyaa/types';

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const setAuth = useAuth((s) => s.setAuth);
  const challenge = params.get('challenge') ?? '';
  const next = params.get('next') ?? '/dashboard';
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const r = await api<{ accessToken: string; expiresIn: number; principal: Principal }>(
        '/auth/mfa/verify',
        { method: 'POST', json: { challenge, code } },
      );
      setAuth(r);
      router.push(next);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border border-border p-6">
      <h1 className="text-xl font-semibold">Verify it's you</h1>
      <p className="text-sm text-muted-foreground">
        We've sent a 6-digit code to your email. It expires in 10 minutes.
      </p>
      <Input
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
      />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <Button type="submit" disabled={loading || code.length !== 6} className="w-full">
        {loading ? 'Verifying…' : 'Verify and sign in'}
      </Button>
    </form>
  );
}

export default function MfaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Inner />
      </Suspense>
    </main>
  );
}
