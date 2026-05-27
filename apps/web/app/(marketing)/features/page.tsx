import Link from 'next/link';
import {
  Bot, MessageSquare, Workflow, Megaphone, BarChart3, Plug, Sparkles,
  ShieldCheck, Users, BookOpen, Zap, Mic, Globe, ArrowRight, FileText,
} from 'lucide-react';

export const metadata = {
  title: 'Features — diyaa.ai',
  description: 'AI agents, shared inbox, visual flows, campaigns, CRM, integrations. Everything WhatsApp commerce needs.',
};

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Built for serious WhatsApp commerce</h1>
        <p className="mt-4 text-muted-foreground md:text-lg">
          Most platforms ship a chatbot and call it a day. diyaa.ai handles the entire customer journey.
        </p>
      </div>

      <FeatureSection
        icon={Bot}
        title="AI agents that actually understand your business"
        body="Train an agent on your knowledge base — FAQs, pricing, policies, product catalog. RAG retrieves the right context for every message. Set custom personas, languages, and handoff keywords. Powered by GPT-4o."
        bullets={['Custom system prompt + persona', 'Knowledge base with vector search', 'Multi-language replies', 'Smart human handoff', 'Per-conversation AI on/off']}
      />
      <FeatureSection
        reverse
        icon={MessageSquare}
        title="Shared inbox the whole team uses"
        body="Multiple agents, one number, zero collisions. Internal notes, quick replies, conversation assignment, and tags. Realtime — no refresh, no lag."
        bullets={['Collision avoidance', 'Internal notes', 'Quick replies', 'Auto-assignment rules', 'Realtime updates via websocket']}
      />
      <FeatureSection
        icon={Workflow}
        title="Visual flow builder for everything else"
        body="Drag-drop logic for keyword triggers, conditions, AI replies, deal updates, payment links, webhooks, and external integrations. 13 node types out of the box."
        bullets={['Keyword & event triggers', 'Conditions & branching', 'Send templates / AI / payments', 'Update CRM deals', 'Call external APIs']}
      />
      <FeatureSection
        reverse
        icon={Megaphone}
        title="Campaigns that don't get you banned"
        body="Throttled delivery, opt-out compliance, per-template tracking. Cold contacts get templates only (Meta-required). Warm contacts get freeform."
        bullets={['Segmented broadcasts', 'Throttled queue worker', 'Opt-out auto-handling', 'Template approval status sync', 'Per-campaign analytics']}
      />
      <FeatureSection
        icon={Users}
        title="Real CRM, not just a contact list"
        body="Pipelines, deal stages, activity timelines, contact tags. Drag deals across stages right from the conversation."
        bullets={['Multiple pipelines', 'Drag-drop deal board', 'Activity timeline per contact', 'Custom tags & metadata', 'Deal notes & tasks']}
      />
      <FeatureSection
        reverse
        icon={Plug}
        title="Integrations that ship from day one"
        body="Razorpay payment links inside the chat. Shopify orders. Google Calendar booking. Zoho CRM sync. Webhooks to anywhere."
        bullets={['Razorpay payments', 'Shopify orders & catalog', 'Google Calendar', 'Zoho CRM', 'Outbound webhooks']}
      />

      <div className="mt-16 grid gap-4 md:grid-cols-3">
        <Card icon={BarChart3} title="Analytics" body="Conversation volume, AI vs human ratio, agent performance, conversion funnels." />
        <Card icon={BookOpen} title="Knowledge bases" body="Upload docs or paste content. We embed and retrieve at agent runtime." />
        <Card icon={Zap} title="Quick replies" body="Snippets your team can fire with /shortcut from the inbox." />
        <Card icon={Mic} title="Voice notes" body="Inbound voice messages auto-transcribed via Sarvam (Indian languages)." />
        <Card icon={Sparkles} title="Industry templates" body="Pre-built agent + flow + KB bundles for clinics, coaching, real estate, D2C." />
        <Card icon={FileText} title="WhatsApp templates" body="Sync, submit, and track Meta-approved message templates from inside the app." />
        <Card icon={ShieldCheck} title="Encrypted everywhere" body="AES-256-GCM for tokens. HMAC for webhooks. Postgres SSL. JWT-based auth." />
        <Card icon={Globe} title="Multi-language" body="Reply in any language the model supports. Hindi, Tamil, Telugu, English by default." />
      </div>

      <div className="mt-16 rounded-2xl bg-foreground p-12 text-center text-background">
        <h2 className="text-3xl font-bold md:text-4xl">Stop juggling tools. Use one.</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm opacity-80">
          Free forever for solo businesses. ₹999/mo for serious teams.
        </p>
        <Link
          href="/signup"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-background px-5 py-2.5 text-sm font-medium text-foreground hover:opacity-90"
        >
          Start free <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

function FeatureSection({
  icon: Icon,
  title,
  body,
  bullets,
  reverse,
}: {
  icon: typeof Bot;
  title: string;
  body: string;
  bullets: string[];
  reverse?: boolean;
}) {
  return (
    <section className={`grid items-center gap-10 py-16 md:grid-cols-2 ${reverse ? 'md:[&>div:first-child]:order-2' : ''}`}>
      <div>
        <Icon size={28} className="text-[var(--brand,#6366f1)]" />
        <h2 className="mt-4 text-3xl font-bold tracking-tight">{title}</h2>
        <p className="mt-3 text-muted-foreground">{body}</p>
        <ul className="mt-5 space-y-2 text-sm">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2">
              <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand,#6366f1)]" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="aspect-video rounded-xl border border-border/60 bg-gradient-to-br from-muted/40 to-muted/10" />
    </section>
  );
}

function Card({ icon: Icon, title, body }: { icon: typeof Bot; title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border/60 p-6">
      <Icon size={20} className="text-[var(--brand,#6366f1)]" />
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
