'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface Tpl {
  vertical: string;
  label: string;
  agent: { name: string; persona: string };
  pipelineStages: string[];
  flowCount: number;
  kbSeeds: number;
}

export default function TemplatesPage() {
  const [applied, setApplied] = useState<Record<string, string>>({});
  const { data } = useQuery({
    queryKey: ['templates'],
    queryFn: () => api<Tpl[]>('/templates'),
  });

  const apply = useMutation({
    mutationFn: (vertical: string) =>
      api<{ agentId: string; pipelineId: string }>('/templates/apply', {
        method: 'POST',
        json: { vertical },
      }),
  });

  return (
    <div className="h-full overflow-auto p-6">
      <h1 className="mb-1 text-2xl font-semibold">Vertical Templates</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Pick your business type and we'll set up a sensible AI agent, sales pipeline, knowledge
        base seeds, and starter flows in seconds. You can edit everything afterward.
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data?.map((t) => (
          <div key={t.vertical} className="rounded-md border border-border p-4">
            <h3 className="font-semibold">{t.label}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Agent: {t.agent.name} · {t.agent.persona}
            </p>
            <div className="mt-3 text-xs text-muted-foreground">
              Pipeline: {t.pipelineStages.join(' → ')}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t.flowCount} flow{t.flowCount === 1 ? '' : 's'} · {t.kbSeeds} KB seed{t.kbSeeds === 1 ? '' : 's'}
            </div>
            <Button
              className="mt-4 w-full"
              size="sm"
              disabled={apply.isPending || !!applied[t.vertical]}
              onClick={async () => {
                const r = await apply.mutateAsync(t.vertical);
                setApplied((a) => ({ ...a, [t.vertical]: r.agentId }));
              }}
            >
              {applied[t.vertical] ? 'Applied' : apply.isPending ? 'Applying…' : 'Apply'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
