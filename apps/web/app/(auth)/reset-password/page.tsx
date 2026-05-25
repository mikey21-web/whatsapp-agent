'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      await api('/auth/password/confirm-reset', {
        method: 'POST',
        json: { token, password },
      });
      setDone(true);
      setTimeout(() => router.push('/login/agency'), 1200);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border border-border p-6">
      <h1 className="text-xl font-semibold">Reset password</h1>
      {done ? (
        <p className="text-sm text-muted-foreground">Password updated. Redirecting…</p>
      ) : (
        <>
          <Input
            type="password"
            required
            minLength={8}
            placeholder="New password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button type="submit" disabled={loading || !token} className="w-full">
            {loading ? 'Saving…' : 'Set new password'}
          </Button>
        </>
      )}
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Inner />
      </Suspense>
    </main>
  );
}
