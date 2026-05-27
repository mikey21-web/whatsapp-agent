'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-store';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

interface Status {
  subscription: {
    plan: string;
    status: string;
    currentPeriodEnd: string;
    razorpaySubId: string | null;
  } | null;
  usage: {
    plan: string;
    limits: {
      clients: number;
      numbersPerClient: number;
      messagesPerMonth: number;
      agents: number;
      contacts: number;
    };
    current: {
      clients: number;
      numbers: number;
      messages: number;
      agents: number;
      contacts: number;
    };
  };
}

interface Plan {
  id: string;
  label: string;
  priceInr: number;
  highlights: string[];
}

export default function ClientBillingPage() {
  const router = useRouter();
  const principal = useAuth((s) => s.principal);
  const qc = useQueryClient();

  useEffect(() => {
    if (!principal) router.replace('/login/client');
    else if (principal.type === 'AGENCY') router.replace('/agency/billing');
  }, [principal, router]);

  const { data: status } = useQuery({
    queryKey: ['billing-status'],
    queryFn: () => api<Status>('/billing/status'),
    enabled: !!principal && principal.type !== 'AGENCY',
  });
  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api<Plan[]>('/plans'),
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
    <div className="h-full overflow-auto p-6 md:p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-2xl font-semibold">Plan &amp; usage</h1>

        {status && (
          <section className="mb-8 rounded-lg border border-border p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Current plan: {status.usage.plan}</h2>
                {status.subscription && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Status: <strong>{status.subscription.status}</strong>
                    {' · Renews '}
                    {new Date(status.subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
              </div>
              {status.subscription && status.subscription.status !== 'CANCELLED' && status.usage.plan !== 'FREE' && (
                <Button variant="outline" size="sm" onClick={() => cancel.mutate()}>
                  Cancel
                </Button>
              )}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <UsageBar label="Messages this month" current={status.usage.current.messages} max={status.usage.limits.messagesPerMonth} />
              <UsageBar label="Contacts" current={status.usage.current.contacts} max={status.usage.limits.contacts} />
              <UsageBar label="AI agents" current={status.usage.current.agents} max={status.usage.limits.agents} />
              <UsageBar label="WhatsApp numbers" current={status.usage.current.numbers} max={status.usage.limits.numbersPerClient * Math.max(1, status.usage.current.clients)} />
            </div>
          </section>
        )}

        <h2 className="mb-3 font-semibold">Switch plan</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {plans?.map((p) => {
            const isCurrent = status?.usage.plan === p.id;
            return (
              <div
                key={p.id}
                className={`flex flex-col rounded-lg border p-5 transition ${
                  isCurrent ? 'border-foreground bg-muted/30' : 'border-border hover:border-foreground/30'
                }`}
              >
                <h3 className="font-semibold">{p.label}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-bold">₹{p.priceInr.toLocaleString('en-IN')}</span>
                  <span className="text-xs text-muted-foreground">/mo</span>
                </div>
                <ul className="mt-4 flex-1 space-y-1.5 text-xs">
                  {p.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-1.5">
                      <Check size={12} className="mt-0.5 shrink-0 text-[var(--brand,#6366f1)]" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-5 w-full"
                  variant={isCurrent ? 'outline' : 'default'}
                  size="sm"
                  disabled={isCurrent || checkout.isPending}
                  onClick={() => checkout.mutate(p.id)}
                >
                  {isCurrent ? 'Current plan' : p.priceInr === 0 ? 'Downgrade to free' : 'Choose plan'}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          Plan changes take effect immediately. WhatsApp messaging fees from Meta are billed separately at cost.
        </p>
      </div>
    </div>
  );
}

function UsageBar({ label, current, max }: { label: string; current: number; max: number }) {
  const unlimited = max >= Number.MAX_SAFE_INTEGER;
  const pct = unlimited || max === 0 ? 0 : Math.min(100, (current / max) * 100);
  const near = pct > 80;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span>{label}</span>
        <span className={near ? 'font-medium text-amber-600' : 'text-muted-foreground'}>
          {current.toLocaleString()} {unlimited ? '' : `/ ${max.toLocaleString()}`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={near ? 'h-full bg-amber-500 transition-all' : 'h-full bg-[var(--brand,#6366f1)] transition-all'}
          style={{ width: unlimited ? '100%' : `${pct}%`, opacity: unlimited ? 0.3 : 1 }}
        />
      </div>
    </div>
  );
}
