'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Overview {
  windowDays: number;
  messages: { inbound: number; outbound: number; aiHandledPct: number };
  conversations: { open: number; resolvedInWindow: number };
  contacts: { newInWindow: number };
  deals: {
    createdInWindow: number;
    wonInWindow: number;
    lostInWindow: number;
    revenueInWindow: number;
    winRatePct: number;
  };
  campaigns: { sentInWindow: number };
}

interface DailyPoint {
  day: string;
  inbound: number;
  outbound: number;
}

interface AgentRow {
  agentId: string | null;
  name: string;
  role: string | null;
  messages: number;
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);

  const overview = useQuery({
    queryKey: ['analytics-overview', days],
    queryFn: () => api<Overview>(`/analytics/overview?days=${days}`),
  });
  const byDay = useQuery({
    queryKey: ['analytics-by-day', days],
    queryFn: () => api<DailyPoint[]>(`/analytics/messages-by-day?days=${days}`),
  });
  const agents = useQuery({
    queryKey: ['analytics-agents', days],
    queryFn: () => api<AgentRow[]>(`/analytics/agents?days=${days}`),
  });

  return (
    <div className="h-full overflow-auto p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <select
          className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </header>

      {overview.data && (
        <div className="mb-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Stat label="Inbound messages" value={overview.data.messages.inbound} />
          <Stat label="Outbound messages" value={overview.data.messages.outbound} />
          <Stat label="AI-handled" suffix="%" value={overview.data.messages.aiHandledPct} />
          <Stat label="Open conversations" value={overview.data.conversations.open} />
          <Stat label="Resolved" value={overview.data.conversations.resolvedInWindow} />
          <Stat label="New contacts" value={overview.data.contacts.newInWindow} />
          <Stat label="Deals won" value={overview.data.deals.wonInWindow} />
          <Stat
            label="Win rate"
            suffix="%"
            value={overview.data.deals.winRatePct}
          />
          <Stat
            label="Revenue (won)"
            prefix="₹"
            value={overview.data.deals.revenueInWindow}
          />
          <Stat label="Campaigns sent" value={overview.data.campaigns.sentInWindow} />
        </div>
      )}

      {byDay.data && byDay.data.length > 0 && (
        <section className="mb-6 rounded-md border border-border p-4">
          <h2 className="mb-3 font-semibold">Messages per day</h2>
          <DailyChart points={byDay.data} />
        </section>
      )}

      {agents.data && (
        <section className="rounded-md border border-border p-4">
          <h2 className="mb-3 font-semibold">Team performance</h2>
          {agents.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No outbound messages from team members in this window.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-left">
                <tr>
                  <th className="p-2">Agent</th>
                  <th className="p-2">Role</th>
                  <th className="p-2 text-right">Messages</th>
                </tr>
              </thead>
              <tbody>
                {agents.data.map((row) => (
                  <tr key={row.agentId ?? row.name} className="border-t border-border">
                    <td className="p-2">{row.name}</td>
                    <td className="p-2 text-muted-foreground">{row.role ?? '—'}</td>
                    <td className="p-2 text-right">{row.messages}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({
  label, value, prefix, suffix,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">
        {prefix}
        {Number.isFinite(value) ? value.toLocaleString('en-IN') : '0'}
        {suffix}
      </div>
    </div>
  );
}

function DailyChart({ points }: { points: DailyPoint[] }) {
  // Inline SVG chart — keeps the bundle small and avoids a chart-lib dep.
  const W = 720;
  const H = 200;
  const PAD = 28;
  const max = Math.max(1, ...points.map((p) => Math.max(p.inbound, p.outbound)));
  const stepX = (W - PAD * 2) / Math.max(1, points.length - 1);
  const yFor = (v: number) => H - PAD - ((H - PAD * 2) * v) / max;
  const toLine = (key: 'inbound' | 'outbound') =>
    points.map((p, i) => `${PAD + stepX * i},${yFor(p[key])}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Messages per day">
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="currentColor" strokeOpacity="0.2" />
      <polyline fill="none" stroke="#0ea5e9" strokeWidth="2" points={toLine('inbound')} />
      <polyline fill="none" stroke="#6366f1" strokeWidth="2" points={toLine('outbound')} />
      <g fontSize="10" fill="currentColor" opacity="0.6">
        <text x={PAD} y={H - 6}>{points[0]?.day}</text>
        <text x={W - PAD} y={H - 6} textAnchor="end">{points[points.length - 1]?.day}</text>
        <text x={PAD - 4} y={PAD + 4} textAnchor="end">{max}</text>
        <text x={PAD - 4} y={H - PAD + 3} textAnchor="end">0</text>
      </g>
      <g fontSize="10">
        <rect x={W - 140} y={6} width="10" height="2" fill="#0ea5e9" />
        <text x={W - 124} y={10}>inbound</text>
        <rect x={W - 70} y={6} width="10" height="2" fill="#6366f1" />
        <text x={W - 54} y={10}>outbound</text>
      </g>
    </svg>
  );
}
