'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatRelative } from '@/lib/utils';

interface Flow {
  id: string;
  name: string;
  trigger: string;
  isActive: boolean;
  createdAt: string;
}

const TRIGGERS = [
  'INBOUND_MESSAGE',
  'KEYWORD',
  'NEW_CONTACT',
  'DEAL_STAGE_CHANGE',
  'SCHEDULED',
  'WEBHOOK',
];

export default function FlowsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { data } = useQuery({ queryKey: ['flows'], queryFn: () => api<Flow[]>('/flows') });
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState<string>('INBOUND_MESSAGE');

  const create = useMutation({
    mutationFn: () =>
      api<Flow>('/flows', {
        method: 'POST',
        json: {
          name,
          trigger,
          doc: {
            nodes: [
              { id: 't', kind: 'TRIGGER', data: {}, position: { x: 80, y: 80 } },
              { id: 'end', kind: 'END', data: {}, position: { x: 320, y: 80 } },
            ],
            edges: [{ id: 'e1', source: 't', target: 'end' }],
          },
        },
      }),
    onSuccess: (f) => {
      qc.invalidateQueries({ queryKey: ['flows'] });
      setName('');
      router.push(`/dashboard/flows/${f.id}`);
    },
  });

  const toggle = useMutation({
    mutationFn: (f: Flow) =>
      api(`/flows/${f.id}`, { method: 'PATCH', json: { isActive: !f.isActive } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flows'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/flows/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flows'] }),
  });

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Flows</h1>
          <p className="text-sm text-muted-foreground">
            Drag-drop automation rules. Open one to edit nodes and connections.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Input
            className="w-48"
            placeholder="Flow name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="h-10 rounded-md border border-border bg-transparent px-2 text-sm"
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
          >
            {TRIGGERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>
            {create.isPending ? 'Creating…' : 'New flow'}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No flows yet. Create one above or apply a vertical template.
          </p>
        )}
        {data?.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between rounded-md border border-border p-3"
          >
            <Link href={`/dashboard/flows/${f.id}`} className="flex-1 hover:underline">
              <div className="font-medium">{f.name}</div>
              <div className="text-xs text-muted-foreground">
                {f.trigger} · {f.isActive ? 'active' : 'paused'} · created{' '}
                {formatRelative(f.createdAt)}
              </div>
            </Link>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => toggle.mutate(f)}>
                {f.isActive ? 'Pause' : 'Activate'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => remove.mutate(f.id)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
