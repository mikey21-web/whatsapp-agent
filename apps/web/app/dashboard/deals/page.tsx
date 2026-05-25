'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Stage {
  id: string;
  name: string;
  color: string;
  order: number;
  deals: {
    id: string;
    title: string;
    value: number | null;
    currency: string;
    contact: { id: string; name: string | null; phone: string };
  }[];
}
interface Pipeline {
  id: string;
  name: string;
  stages: Stage[];
}

export default function DealsPage() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newPipe, setNewPipe] = useState('');

  const { data: pipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => api<Pipeline[]>('/pipelines'),
  });
  const active = pipelines?.find((p) => p.id === activeId) ?? pipelines?.[0];

  const createPipe = useMutation({
    mutationFn: () => api<Pipeline>('/pipelines', { method: 'POST', json: { name: newPipe } }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['pipelines'] });
      setActiveId(created.id);
      setNewPipe('');
    },
  });

  const { data: board } = useQuery({
    queryKey: ['board', active?.id],
    queryFn: () => api<Pipeline>(`/pipelines/${active!.id}/board`),
    enabled: !!active?.id,
    refetchInterval: 15_000,
  });

  const moveDeal = useMutation({
    mutationFn: ({ dealId, stageId }: { dealId: string; stageId: string }) =>
      api(`/deals/${dealId}/stage`, { method: 'PATCH', json: { stageId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['board', active?.id] }),
  });

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Deals</h1>
          <select
            className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
            value={active?.id ?? ''}
            onChange={(e) => setActiveId(e.target.value)}
          >
            {pipelines?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Input
            className="w-48"
            placeholder="New pipeline"
            value={newPipe}
            onChange={(e) => setNewPipe(e.target.value)}
          />
          <Button size="sm" disabled={!newPipe} onClick={() => createPipe.mutate()}>
            Create
          </Button>
        </div>
      </header>

      <div className="flex flex-1 gap-3 overflow-x-auto p-4">
        {board?.stages.map((s) => (
          <div
            key={s.id}
            className="flex h-full w-72 shrink-0 flex-col rounded-md border border-border"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const dealId = e.dataTransfer.getData('text/dealId');
              if (dealId) moveDeal.mutate({ dealId, stageId: s.id });
            }}
          >
            <div
              className="flex items-center justify-between rounded-t-md p-3 text-sm font-medium"
              style={{ borderBottom: `2px solid ${s.color}` }}
            >
              <span>{s.name}</span>
              <span className="text-xs text-muted-foreground">{s.deals.length}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-2">
              {s.deals.map((d) => (
                <div
                  key={d.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/dealId', d.id)}
                  className="cursor-grab rounded-md border border-border bg-background p-2 text-sm shadow-sm hover:border-[var(--brand)]"
                >
                  <div className="font-medium">{d.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.contact.name ?? d.contact.phone}
                  </div>
                  {d.value !== null && (
                    <div className="mt-1 text-xs">
                      {d.currency} {d.value.toLocaleString('en-IN')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {!board && pipelines && pipelines.length === 0 && (
          <div className="m-auto text-sm text-muted-foreground">
            No pipelines yet. Create one above to get started.
          </div>
        )}
      </div>
    </div>
  );
}
