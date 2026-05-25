'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-store';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface VerifyResponse {
  ok: boolean;
  expected: string;
  cname: string[];
  a: string[];
  detail?: string;
}

export default function DomainPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const principal = useAuth((s) => s.principal);

  useEffect(() => {
    if (!principal || principal.type !== 'AGENCY') router.replace('/login/agency');
  }, [principal, router]);

  const [hostname, setHostname] = useState('');

  // Reuse /auth/me to find the current customDomain, falling back to a domain status call.
  const { data: status } = useQuery({
    queryKey: ['domain-verify'],
    queryFn: () => api<VerifyResponse>('/agency/domain/verify').catch(() => null),
    enabled: principal?.type === 'AGENCY',
    refetchInterval: 30_000,
  });

  const set = useMutation({
    mutationFn: () =>
      api<{ customDomain: string }>('/agency/domain', { method: 'POST', json: { hostname } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domain-verify'] });
      setHostname('');
    },
  });

  const clear = useMutation({
    mutationFn: () => api('/agency/domain', { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['domain-verify'] }),
  });

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-2 text-2xl font-semibold">Custom domain</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Point your own domain at the platform. Add a CNAME record from your DNS to the platform's
        apex, then verify here. SSL is provisioned automatically on first request.
      </p>

      <div className="space-y-4 rounded-md border border-border p-6">
        <div className="flex gap-2">
          <Input
            placeholder="app.youragency.com"
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
          />
          <Button onClick={() => set.mutate()} disabled={!hostname || set.isPending}>
            Save
          </Button>
        </div>

        {status && (
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${status.ok ? 'bg-green-500' : 'bg-amber-500'}`}
              />
              <strong>{status.ok ? 'DNS verified' : 'DNS not configured'}</strong>
            </div>
            <div className="mb-2 text-xs">
              Add a <code className="rounded bg-muted px-1">CNAME</code> record:
            </div>
            <pre className="rounded bg-background p-2 text-xs">
              CNAME → {status.expected}
            </pre>
            {status.cname.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Found CNAME: {status.cname.join(', ')}
              </p>
            )}
            {status.a.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Found A records: {status.a.join(', ')}
              </p>
            )}
            {status.detail && (
              <p className="mt-2 text-xs text-muted-foreground">{status.detail}</p>
            )}
          </div>
        )}

        <div className="text-right">
          <Button variant="outline" size="sm" onClick={() => clear.mutate()}>
            Remove domain
          </Button>
        </div>
      </div>
    </main>
  );
}
