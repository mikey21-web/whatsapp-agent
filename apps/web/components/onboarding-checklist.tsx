'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

interface Account { id: string }
interface Agent { id: string; isActive: boolean }
interface Contact { id: string }

/**
 * Top-of-dashboard onboarding bar. Renders nothing once all three steps are
 * complete. Polls cheaply (no realtime needed) since the user only sees this
 * during initial setup.
 */
export function OnboardingChecklist() {
  const { data: accounts } = useQuery({
    queryKey: ['onboard-accounts'],
    queryFn: () => api<Account[]>('/whatsapp/accounts'),
    staleTime: 30_000,
  });
  const { data: agents } = useQuery({
    queryKey: ['onboard-agents'],
    queryFn: () => api<Agent[]>('/ai-agents'),
    staleTime: 30_000,
  });
  const { data: contacts } = useQuery({
    queryKey: ['onboard-contacts'],
    queryFn: () => api<{ items: Contact[] }>('/contacts?limit=1'),
    staleTime: 30_000,
  });

  const hasNumber = (accounts?.length ?? 0) > 0;
  const hasAgent = (agents?.length ?? 0) > 0;
  const hasContact = (contacts?.items?.length ?? 0) > 0;

  // Hide when fully onboarded.
  if (hasNumber && hasAgent && hasContact) return null;

  // Don't flash before data loads.
  if (!accounts || !agents || !contacts) return null;

  const steps = [
    {
      done: hasNumber,
      title: 'Connect WhatsApp',
      body: 'Use Meta\'s 1-click signup to connect your business number.',
      cta: 'Connect',
      href: '/dashboard/settings/connect-whatsapp',
    },
    {
      done: hasAgent,
      title: 'Create your AI agent',
      body: 'Set persona + system prompt. Replies kick in instantly.',
      cta: 'Create agent',
      href: '/dashboard/agents',
    },
    {
      done: hasContact,
      title: 'Add or import contacts',
      body: 'Or just wait — they appear automatically when customers message you.',
      cta: 'Import CSV',
      href: '/dashboard/contacts',
    },
  ];

  const completed = steps.filter((s) => s.done).length;

  return (
    <section className="border-b border-border bg-gradient-to-r from-[var(--brand,#6366f1)]/5 to-transparent p-4">
      <div className="mx-auto max-w-5xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Get started ({completed} of {steps.length})</h2>
          <Link href="/dashboard/billing" className="text-xs text-muted-foreground hover:underline">
            View plan →
          </Link>
        </div>
        <ol className="grid gap-2 md:grid-cols-3">
          {steps.map((s) => (
            <li
              key={s.title}
              className={`flex items-start gap-3 rounded-md border p-3 transition ${
                s.done ? 'border-border bg-muted/30 opacity-70' : 'border-border bg-background'
              }`}
            >
              {s.done ? (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />
              ) : (
                <Circle size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{s.title}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{s.body}</div>
                {!s.done && (
                  <Link
                    href={s.href}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--brand,#6366f1)] hover:underline"
                  >
                    {s.cta} <ArrowRight size={11} />
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
