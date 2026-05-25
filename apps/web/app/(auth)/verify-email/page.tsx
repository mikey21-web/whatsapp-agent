'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

function Inner() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'loading' | 'ok' | 'fail'>('loading');

  useEffect(() => {
    if (!token) {
      setState('fail');
      return;
    }
    api('/auth/email/verify', { method: 'POST', json: { token } })
      .then(() => setState('ok'))
      .catch(() => setState('fail'));
  }, [token]);

  return (
    <div className="w-full max-w-sm space-y-3 rounded-lg border border-border p-6 text-center">
      {state === 'loading' && <p className="text-sm text-muted-foreground">Verifying…</p>}
      {state === 'ok' && (
        <>
          <h1 className="text-xl font-semibold">Email verified</h1>
          <p className="text-sm text-muted-foreground">
            You're all set. <Link href="/login/agency" className="underline">Sign in</Link>.
          </p>
        </>
      )}
      {state === 'fail' && (
        <>
          <h1 className="text-xl font-semibold">Verification failed</h1>
          <p className="text-sm text-muted-foreground">
            The link may have expired. Sign in and request a new verification email.
          </p>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Inner />
      </Suspense>
    </main>
  );
}
