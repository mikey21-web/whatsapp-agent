'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/auth/password/request-reset', { method: 'POST', json: { email } });
      setSent(true);
    } catch {
      setSent(true); // never leak existence
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border border-border p-6">
        <h1 className="text-xl font-semibold">Forgot password</h1>
        {sent ? (
          <p className="text-sm text-muted-foreground">
            If an account exists for {email}, we've sent a reset link. Check your inbox (and spam folder).
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Enter the email you signed up with. We'll send a reset link.
            </p>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>
          </>
        )}
      </form>
    </main>
  );
}
