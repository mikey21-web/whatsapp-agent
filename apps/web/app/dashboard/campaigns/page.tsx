'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatRelative } from '@/lib/utils';

interface Campaign {
  id: string;
  name: string;
  type: string;
  template: string | null;
  status: string;
  recipients: number;
  delivered: number;
  read: number;
  replied: number;
  createdAt: string;
}

export default function CampaignsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api<Campaign[]>('/campaigns'),
    refetchInterval: 10_000,
  });

  const [form, setForm] = useState({ name: '', template: '', tagFilter: '' });

  const create = useMutation({
    mutationFn: () =>
      api<Campaign>('/campaigns', {
        method: 'POST',
        json: { name: form.name, type: 'BROADCAST', template: form.template },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      setForm({ name: '', template: '', tagFilter: '' });
    },
  });

  const start = useMutation({
    mutationFn: ({ id, tagFilter }: { id: string; tagFilter: string[] }) =>
      api(`/campaigns/${id}/start`, { method: 'POST', json: { tagFilter } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });

  return (
    <div className="h-full overflow-auto p-6">
      <h1 className="mb-4 text-2xl font-semibold">Campaigns</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3 rounded-md border border-border p-4">
          <h2 className="font-semibold">New broadcast</h2>
          <Input
            placeholder="Campaign name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <textarea
            className="min-h-[120px] w-full rounded-md border border-border bg-transparent p-2 text-sm"
            placeholder="Hi {{ name }}, here's our latest update…"
            value={form.template}
            onChange={(e) => setForm({ ...form, template: e.target.value })}
          />
          <Input
            placeholder="Tag filter (comma-separated, optional)"
            value={form.tagFilter}
            onChange={(e) => setForm({ ...form, tagFilter: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Available variables: <code>{'{{ name }}'}</code>, <code>{'{{ phone }}'}</code>
          </p>
          <Button
            disabled={!form.name || !form.template || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Creating…' : 'Create draft'}
          </Button>
        </div>

        <div className="space-y-3">
          <h2 className="font-semibold">Campaigns</h2>
          {data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No campaigns yet.</p>
          )}
          {data?.map((c) => (
            <div key={c.id} className="rounded-md border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.type} · {c.status} · {formatRelative(c.createdAt)}
                  </div>
                </div>
                {c.status === 'DRAFT' && (
                  <Button
                    size="sm"
                    onClick={() =>
                      start.mutate({
                        id: c.id,
                        tagFilter: form.tagFilter
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                  >
                    Send
                  </Button>
                )}
              </div>
              {c.template && (
                <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                  {c.template}
                </p>
              )}
              {c.recipients > 0 && (
                <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
                  <Stat label="Recipients" value={c.recipients} />
                  <Stat label="Delivered" value={c.delivered} />
                  <Stat label="Read" value={c.read} />
                  <Stat label="Replied" value={c.replied} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/50 p-2 text-center">
      <div className="font-semibold">{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}
