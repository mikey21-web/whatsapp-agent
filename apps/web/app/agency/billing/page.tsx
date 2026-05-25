'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-store';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface Status {
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: string;
    razorpaySubId: string | null;
  } | null;
  usage: {
    plan: string;
    limits: { clients: number; numbersPerClient: number; messagesPerMonth: number };
    current: { clients: number; numbers: number; messages: number };
  };
}

const PLANS = [
  { id: 'STARTER', label: 'Starter', price: 2999, blurb: '3 clients · 5,000 msgs/mo' },
  { id: 'GROWTH', label: 'Growth', price: 6999, blurb: '15 clients · 25,000 msgs/mo' },
  { id: 'SCALE', label: 'Scale', price: 14999, blurb: 'Unlimited clients · Unlimited msgs' },
];

export default function BillingPage() {
  const router = useRouter();
  const principal = useAuth((s) => s.principal);
  const qc = useQueryClient();

  useEffect(() => {
    if (!principal || principal.type !== 'AGENCY') router.replace('/login/agency');
  }, [principal, router]);

  const { data } = useQuery({
    queryKey: ['billing-status'],
    queryFn: () => api<Status>('/billing/status'),
    enabled: principal?.type === 'AGENCY',
  });

  const checkout = useMutation({
    mutationFn: (plan: string) =>
      api<{ subscriptionId: string; shortUrl: string | null }>('/billing/checkout', {
        method: 'POST',
        json: { plan },
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['billing-status'] });
      if (r.shortUrl) window.location.href = r.shortUrl;
    },
  });

  const cancel = useMutation({
    mutationFn: () => api('/billing/cancel', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing-status'] }),
  });

  return (
    <main className="mx-auto max-w-4xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Billing</h1>

      {data && (
        <section className="mb-8 rounded-md border border-border p-6">
          <h2 className="mb-4 font-semibold">Usage this period</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <UsageBar
              label="Clients"
              current={data.usage.current.clients}
              max={data.usage.limits.clients}
            />
            <UsageBar
              label="WhatsApp numbers"
              current={data.usage.current.numbers}
              max={data.usage.limits.numbersPerClient * Math.max(1, data.usage.current.clients)}
            />
            <UsageBar
              label="Messages this month"
              current={data.usage.current.messages}
              max={data.usage.limits.messagesPerMonth}
            />
          </div>
          {data.subscription && (
            <div className="mt-4 text-xs text-muted-foreground">
              Plan: <strong>{data.subscription.plan}</strong> · Status:{' '}
              <strong>{data.subscription.status}</strong> · Renews:{' '}
              {new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}
            </div>
          )}
        </section>
      )}

      <h2 className="mb-3 font-semibold">Plans</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const isCurrent = data?.subscription?.plan === p.id;
          return (
            <div
              key={p.id}
              className={`rounded-md border p-6 ${
                isCurrent ? 'border-[var(--brand)] bg-muted/30' : 'border-border'
              }`}
            >
              <h3 className="text-lg font-semibold">{p.label}</h3>
              <div className="mt-2 text-3xl font-bold">
                ₹{p.price.toLocaleString('en-IN')}
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{p.blurb}</p>
              <Button
                className="mt-6 w-full"
                disabled={isCurrent || checkout.isPending}
                onClick={() => checkout.mutate(p.id)}
              >
                {isCurrent ? 'Current plan' : 'Choose plan'}
              </Button>
            </div>
          );
        })}
      </div>

      {data?.subscription && data.subscription.status !== 'CANCELLED' && (
        <div className="mt-6 text-right">
          <Button variant="outline" size="sm" onClick={() => cancel.mutate()}>
            Cancel subscription
          </Button>
        </div>
      )}
    </main>
  );
}

function UsageBar({ label, current, max }: { label: string; current: number; max: number }) {
  const pct = max === 0 || max === Number.MAX_SAFE_INTEGER ? 0 : Math.min(100, (current / max) * 100);
  const unlimited = max >= Number.MAX_SAFE_INTEGER;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {current.toLocaleString()} {unlimited ? '' : `/ ${max.toLocaleString()}`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-[var(--brand)] transition-all"
          style={{ width: unlimited ? '100%' : `${pct}%`, opacity: unlimited ? 0.3 : 1 }}
        />
      </div>
    </div>
  );
}
