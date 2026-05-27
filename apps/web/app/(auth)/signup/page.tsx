'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import type { Principal } from '@diyaa/types';

interface SignupResponse {
  accessToken?: string;
  expiresIn?: number;
  principal?: Principal;
}

export default function SignupPage() {
  const router = useRouter();
  const setAuth = useAuth((s) => s.setAuth);

  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setErr('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const r = await api<SignupResponse>('/auth/signup', {
        method: 'POST',
        json: {
          businessName: businessName.trim(),
          email: email.trim(),
          password,
          phone: phone.trim() || undefined,
        },
      });
      if (r.accessToken && r.principal && typeof r.expiresIn === 'number') {
        setAuth({ accessToken: r.accessToken, expiresIn: r.expiresIn, principal: r.principal });
        router.push('/dashboard');
        return;
      }
      setErr('Unexpected response. Try logging in.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold">
            <span className="inline-block h-6 w-6 rounded-md bg-[var(--brand,#6366f1)]" aria-hidden />
            <span>diyaa.ai</span>
          </Link>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-border bg-background p-6 shadow-sm"
        >
          <div>
            <h1 className="text-xl font-semibold">Create your account</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Free forever. No credit card required.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor="biz">Business name</label>
            <Input
              id="biz"
              type="text"
              placeholder="Acme Clinics"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
              minLength={2}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor="email">Work email</label>
            <Input
              id="email"
              type="email"
              placeholder="you@business.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor="password">Password</label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor="phone">Phone (optional)</label>
            <Input
              id="phone"
              type="tel"
              placeholder="+91 9XXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          {err && <p className="text-sm text-red-600">{err}</p>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Creating account...' : 'Start free'}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            By signing up you agree to our terms. Already have an account?{' '}
            <Link href="/login/client" className="underline">Sign in</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
