import Link from 'next/link';
import { ArrowRight, Bot, MessageSquare, Workflow, Megaphone, BarChart3, Plug, Sparkles, ShieldCheck } from 'lucide-react';

export default function HomePage() {
  return (
    <>
      <Hero />
      <SocialProof />
      <FeatureGrid />
      <HowItWorks />
      <PricingTeaser />
      <CtaBlock />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-6 py-20 text-center md:py-28">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs">
          <Sparkles size={12} className="text-[var(--brand,#6366f1)]" />
          <span>Powered by GPT-4o · Meta WhatsApp Cloud API</span>
        </div>
        <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight md:text-6xl">
          AI-powered WhatsApp <br className="hidden md:block" />
          for every business
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-base text-muted-foreground md:text-lg">
          Reply instantly, qualify leads, and close more deals on WhatsApp without lifting a finger.
          Connect your number in 60 seconds. Free forever for solo businesses.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90"
          >
            Start free <ArrowRight size={14} />
          </Link>
          <Link
            href="/pricing"
            className="inline-flex items-center justify-center rounded-md border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted"
          >
            See pricing
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">No credit card · 500 free messages/month</p>
      </div>
    </section>
  );
}

function SocialProof() {
  const verticals = ['Real Estate', 'Clinics', 'Coaching', 'D2C Brands', 'Restaurants', 'Education'];
  return (
    <section className="border-y border-border/40 bg-muted/30 py-8">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Trusted by businesses across</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground">
          {verticals.map((v) => (
            <span key={v}>{v}</span>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: Bot, title: 'AI agents that reply 24/7', body: 'Custom personas, knowledge bases, and RAG over your docs. Hand off to humans on the right keywords.' },
  { icon: MessageSquare, title: 'Shared team inbox', body: 'Collision avoidance, internal notes, quick replies, and assignment. Your whole team on one number.' },
  { icon: Workflow, title: 'Visual flow builder', body: 'Drag-drop automations: keyword triggers, conditions, AI replies, deal updates, payments, webhooks.' },
  { icon: Megaphone, title: 'Campaigns at scale', body: 'Segmented broadcasts with throttled delivery, opt-out compliance, and per-template analytics.' },
  { icon: BarChart3, title: 'CRM + deal pipelines', body: 'Drag deals across stages, track activities, see the full conversation timeline per contact.' },
  { icon: Plug, title: 'Integrations included', body: 'Razorpay payments, Shopify, Google Calendar, Zoho — connect with one click.' },
];

function FeatureGrid() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Everything WhatsApp commerce needs</h2>
        <p className="mt-3 text-muted-foreground">
          A complete platform — not a bot, not a spreadsheet, not a notification tool.
        </p>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-lg border border-border/60 p-6 transition hover:border-border">
            <Icon size={20} className="text-[var(--brand,#6366f1)]" />
            <h3 className="mt-4 font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: 1, title: 'Sign up free', body: 'Create your account in 30 seconds. No credit card.' },
    { n: 2, title: 'Connect WhatsApp', body: 'One-click via Meta Embedded Signup. Use your own business number.' },
    { n: 3, title: 'Train your AI', body: 'Set persona, paste your FAQs or docs into the knowledge base.' },
    { n: 4, title: 'Start replying', body: 'Customers message in. AI handles routine queries. Your team handles the rest.' },
  ];
  return (
    <section className="border-y border-border/40 bg-muted/20 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">From zero to live in 5 minutes</h2>
          <p className="mt-3 text-muted-foreground">Most platforms make you wait days. We don't.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="rounded-lg border border-border/60 bg-background p-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                {s.n}
              </div>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingTeaser() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 text-center">
      <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Pricing that doesn't punish growth</h2>
      <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
        Start free. Upgrade only when you outgrow it. No setup fees. No per-user creep.
      </p>
      <Link
        href="/pricing"
        className="mt-6 inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted"
      >
        Compare plans <ArrowRight size={14} />
      </Link>
    </section>
  );
}

function CtaBlock() {
  return (
    <section className="bg-foreground text-background">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-16 text-center">
        <ShieldCheck size={28} className="opacity-80" />
        <h2 className="text-3xl font-bold md:text-4xl">Built on the official WhatsApp API</h2>
        <p className="max-w-xl text-sm opacity-80">
          Your messages go through Meta's sanctioned channel. No bans, no risk, fully compliant.
        </p>
        <Link
          href="/signup"
          className="mt-2 inline-flex items-center gap-2 rounded-md bg-background px-5 py-2.5 text-sm font-medium text-foreground hover:opacity-90"
        >
          Get started free <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}
