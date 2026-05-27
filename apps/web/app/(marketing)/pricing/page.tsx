import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';

interface Plan {
  id: string;
  label: string;
  priceInr: number;
  highlights: string[];
  limits: {
    messagesPerMonth: number;
    contacts: number;
    agents: number;
    numbers: number;
  };
}

async function getPlans(): Promise<Plan[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    const r = await fetch(`${apiUrl}/plans`, { next: { revalidate: 300 } });
    if (!r.ok) throw new Error('plans fetch failed');
    return (await r.json()) as Plan[];
  } catch {
    // Fallback so the page renders even if the API is down. Stays in sync
    // with apps/api/src/billing/plans.ts so worth touching here on changes.
    return [
      { id: 'FREE', label: 'Free', priceInr: 0, highlights: ['1 WhatsApp number','500 messages / month','100 contacts','1 AI agent','No credit card required'], limits: { messagesPerMonth: 500, contacts: 100, agents: 1, numbers: 1 } },
      { id: 'STARTER', label: 'Starter', priceInr: 999, highlights: ['1 WhatsApp number','5,000 messages / month','2,500 contacts','3 AI agents','Campaigns & broadcasts'], limits: { messagesPerMonth: 5000, contacts: 2500, agents: 3, numbers: 1 } },
      { id: 'GROWTH', label: 'Growth', priceInr: 2999, highlights: ['3 WhatsApp numbers','25,000 messages / month','25,000 contacts','10 AI agents','Visual flow builder','CRM & deal pipeline'], limits: { messagesPerMonth: 25000, contacts: 25000, agents: 10, numbers: 3 } },
      { id: 'SCALE', label: 'Scale', priceInr: 6999, highlights: ['Unlimited WhatsApp numbers','Unlimited messages','Unlimited contacts','Unlimited AI agents','Priority support','Custom integrations'], limits: { messagesPerMonth: Number.MAX_SAFE_INTEGER, contacts: Number.MAX_SAFE_INTEGER, agents: Number.MAX_SAFE_INTEGER, numbers: Number.MAX_SAFE_INTEGER } },
    ];
  }
}

export const metadata = {
  title: 'Pricing — diyaa.ai',
  description: 'Start free. Scale at ₹999/mo. Aggressive pricing built for Indian SMBs.',
};

export default async function PricingPage() {
  const plans = await getPlans();
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Simple, honest pricing</h1>
        <p className="mt-4 text-muted-foreground">
          Start free. Pay only when you grow. Cancel anytime. No hidden per-conversation overage.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} highlighted={p.id === 'GROWTH'} />
        ))}
      </div>

      <div className="mt-16 rounded-lg border border-border/60 bg-muted/20 p-8 text-center">
        <h2 className="text-xl font-semibold">Need higher limits or custom integrations?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Enterprise plans include dedicated support, SLAs, custom AI training, and per-channel pricing.
        </p>
        <a
          href="mailto:hello@diyaa.ai?subject=Enterprise%20inquiry"
          className="mt-4 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-background"
        >
          Talk to sales <ArrowRight size={14} />
        </a>
      </div>

      <FAQ />
    </div>
  );
}

function PlanCard({ plan, highlighted }: { plan: Plan; highlighted: boolean }) {
  const isFree = plan.priceInr === 0;
  return (
    <div
      className={[
        'flex flex-col rounded-xl border p-6 transition',
        highlighted
          ? 'border-foreground bg-muted/40 ring-2 ring-foreground/10'
          : 'border-border/60 bg-background hover:border-border',
      ].join(' ')}
    >
      {highlighted && (
        <div className="mb-3 inline-flex w-fit rounded-full bg-foreground px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-background">
          Most popular
        </div>
      )}
      <h3 className="text-lg font-semibold">{plan.label}</h3>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="text-4xl font-bold">₹{plan.priceInr.toLocaleString('en-IN')}</span>
        <span className="text-sm text-muted-foreground">/mo</span>
      </div>
      <ul className="mt-6 flex-1 space-y-2 text-sm">
        {plan.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2">
            <Check size={14} className="mt-0.5 shrink-0 text-[var(--brand,#6366f1)]" />
            <span>{h}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/signup"
        className={[
          'mt-6 inline-flex w-full items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium',
          highlighted
            ? 'bg-foreground text-background hover:opacity-90'
            : 'border border-border hover:bg-muted',
        ].join(' ')}
      >
        {isFree ? 'Start free' : `Choose ${plan.label}`}
      </Link>
    </div>
  );
}

function FAQ() {
  const items = [
    { q: 'Do I need a credit card to start?', a: 'No. The Free plan is genuinely free. You only need to pay when you upgrade.' },
    { q: 'How does WhatsApp messaging work?', a: 'You connect your own business number through Meta\'s official WhatsApp Cloud API. There\'s a one-click connect flow inside the app.' },
    { q: 'Are there per-conversation charges?', a: 'Meta charges a small per-conversation fee directly to you (typical Indian rate ₹0.10–₹0.80). diyaa.ai itself has no markup on messaging.' },
    { q: 'Can I cancel anytime?', a: 'Yes. Cancel from your billing page; you keep access until the end of the current period.' },
    { q: 'What happens when I hit my message limit?', a: 'Outbound messages pause until the next billing cycle or you upgrade. Inbound is never blocked.' },
    { q: 'Is my data safe?', a: 'Encrypted at rest. Tokens stored with AES-256-GCM. Webhooks signature-verified. Built on the official WhatsApp API — no Web scraping or unofficial bridges.' },
  ];
  return (
    <section className="mt-16">
      <h2 className="text-center text-2xl font-bold">Frequently asked</h2>
      <div className="mx-auto mt-8 grid max-w-3xl gap-6 md:grid-cols-2">
        {items.map((it) => (
          <div key={it.q}>
            <h3 className="font-semibold">{it.q}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{it.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
