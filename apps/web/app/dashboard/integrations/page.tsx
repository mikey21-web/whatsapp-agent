'use client';

import { Suspense, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShoppingBag, Calendar, Database, Building2 } from 'lucide-react';

interface Integration {
  id: string;
  provider: 'SHOPIFY' | 'ZOHO' | 'GOOGLE_CALENDAR' | 'TALLY';
  isActive: boolean;
  connectedAt: string;
  lastSyncAt: string | null;
  metadata: Record<string, unknown>;
}

const META = {
  SHOPIFY: { label: 'Shopify', icon: ShoppingBag, blurb: 'Order status, customers, abandoned carts' },
  GOOGLE_CALENDAR: { label: 'Google Calendar', icon: Calendar, blurb: 'Auto-book appointments and reminders' },
  ZOHO: { label: 'Zoho CRM', icon: Database, blurb: 'Two-way contact sync' },
  TALLY: { label: 'Tally', icon: Building2, blurb: 'Invoice + ledger lookups' },
};

function IntegrationsInner() {
  const params = useSearchParams();
  const justConnected = params.get('connected');
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api<Integration[]>('/integrations'),
    refetchInterval: 15_000,
  });

  const [shop, setShop] = useState('');
  const [tallyKey, setTallyKey] = useState('');

  const start = useMutation({
    mutationFn: async (kind: string) => {
      const path = kind === 'SHOPIFY' && shop
        ? `/integrations/${kind.toLowerCase()}/connect?shop=${encodeURIComponent(shop)}`
        : `/integrations/${kind.toLowerCase()}/connect`;
      return api<{ url: string }>(path);
    },
    onSuccess: (r) => {
      window.location.href = r.url;
    },
  });

  const connectTally = useMutation({
    mutationFn: () => api('/integrations/tally/connect', { method: 'POST', json: { apiKey: tallyKey } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['integrations'] });
      setTallyKey('');
    },
  });

  const disconnect = useMutation({
    mutationFn: (kind: string) => api(`/integrations/${kind}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });

  const byKind = new Map((data ?? []).map((i) => [i.provider, i]));

  return (
    <div className="h-full overflow-auto p-6">
      <h1 className="mb-2 text-2xl font-semibold">Integrations</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Connect external tools so the AI agent can answer order questions, book appointments, and
        sync contacts.
      </p>
      {justConnected && (
        <div className="mb-4 rounded-md border border-green-500 bg-green-50 p-3 text-sm text-green-800">
          {justConnected.toUpperCase()} connected.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(['SHOPIFY', 'GOOGLE_CALENDAR', 'ZOHO', 'TALLY'] as const).map((kind) => {
          const meta = META[kind];
          const Icon = meta.icon;
          const conn = byKind.get(kind);
          return (
            <div key={kind} className="rounded-md border border-border p-4">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <Icon size={16} /> <span>{meta.label}</span>
                {conn && (
                  <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                    Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{meta.blurb}</p>
              {conn ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    Connected {new Date(conn.connectedAt).toLocaleDateString()}
                    {conn.metadata && (conn.metadata as any).shop ? ` · ${(conn.metadata as any).shop}` : ''}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => disconnect.mutate(kind)}
                  >
                    Disconnect
                  </Button>
                </div>
              ) : kind === 'SHOPIFY' ? (
                <div className="mt-3 flex gap-2">
                  <Input
                    placeholder="yourstore.myshopify.com"
                    value={shop}
                    onChange={(e) => setShop(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={!shop || start.isPending}
                    onClick={() => start.mutate('SHOPIFY')}
                  >
                    Connect
                  </Button>
                </div>
              ) : kind === 'TALLY' ? (
                <div className="mt-3 flex gap-2">
                  <Input
                    placeholder="Tally API key"
                    value={tallyKey}
                    onChange={(e) => setTallyKey(e.target.value)}
                  />
                  <Button
                    size="sm"
                    disabled={!tallyKey || connectTally.isPending}
                    onClick={() => connectTally.mutate()}
                  >
                    Save
                  </Button>
                </div>
              ) : (
                <Button
                  className="mt-3"
                  size="sm"
                  disabled={start.isPending}
                  onClick={() => start.mutate(kind)}
                >
                  Connect with {meta.label}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <IntegrationsInner />
    </Suspense>
  );
}
