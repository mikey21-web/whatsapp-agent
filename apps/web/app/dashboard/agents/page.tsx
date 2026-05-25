'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatRelative } from '@/lib/utils';

interface Agent {
  id: string;
  name: string;
  persona: string;
  systemPrompt: string;
  language: string[];
  handoffKeywords: string[];
  isActive: boolean;
  knowledgeBaseId: string | null;
  createdAt: string;
}

interface KB {
  id: string;
  name: string;
  _count?: { documents: number };
}

export default function AgentsPage() {
  const qc = useQueryClient();
  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api<Agent[]>('/ai-agents'),
  });
  const { data: kbs } = useQuery({
    queryKey: ['kbs'],
    queryFn: () => api<KB[]>('/knowledge-bases'),
  });

  const [form, setForm] = useState({
    name: '',
    persona: '',
    systemPrompt: '',
    language: 'en,hi',
    handoffKeywords: 'human,agent,manager',
    knowledgeBaseId: '',
  });

  const createMut = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api<Agent>('/ai-agents', { method: 'POST', json: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      setForm({ ...form, name: '', persona: '', systemPrompt: '' });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api(`/ai-agents/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agents'] }),
  });

  return (
    <div className="h-full overflow-auto p-6">
      <h1 className="mb-4 text-2xl font-semibold">AI Agents</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3 rounded-md border border-border p-4">
          <h2 className="font-semibold">New agent</h2>
          <Input
            placeholder="Name (e.g. Priya)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            placeholder="Persona (e.g. friendly real estate consultant)"
            value={form.persona}
            onChange={(e) => setForm({ ...form, persona: e.target.value })}
          />
          <textarea
            className="min-h-[120px] w-full rounded-md border border-border bg-transparent p-2 text-sm"
            placeholder="System prompt — what should this agent do?"
            value={form.systemPrompt}
            onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
          />
          <Input
            placeholder="Languages (comma-separated, e.g. en,hi,te)"
            value={form.language}
            onChange={(e) => setForm({ ...form, language: e.target.value })}
          />
          <Input
            placeholder="Handoff keywords (comma-separated)"
            value={form.handoffKeywords}
            onChange={(e) => setForm({ ...form, handoffKeywords: e.target.value })}
          />
          <select
            className="w-full rounded-md border border-border bg-transparent p-2 text-sm"
            value={form.knowledgeBaseId}
            onChange={(e) => setForm({ ...form, knowledgeBaseId: e.target.value })}
          >
            <option value="">No knowledge base</option>
            {kbs?.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
          <Button
            disabled={createMut.isPending || !form.name || !form.systemPrompt}
            onClick={() =>
              createMut.mutate({
                name: form.name,
                persona: form.persona,
                systemPrompt: form.systemPrompt,
                language: form.language.split(',').map((s) => s.trim()).filter(Boolean),
                handoffKeywords: form.handoffKeywords
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
                knowledgeBaseId: form.knowledgeBaseId || null,
              })
            }
          >
            {createMut.isPending ? 'Creating…' : 'Create agent'}
          </Button>
        </div>

        <div className="space-y-3">
          <h2 className="font-semibold">Existing agents</h2>
          {agents?.length === 0 && (
            <p className="text-sm text-muted-foreground">No agents yet.</p>
          )}
          {agents?.map((a) => (
            <div key={a.id} className="rounded-md border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.persona} · {a.language.join(', ')}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteMut.mutate(a.id)}
                  disabled={deleteMut.isPending}
                >
                  Delete
                </Button>
              </div>
              <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                {a.systemPrompt}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Created {formatRelative(a.createdAt)}
                {a.handoffKeywords.length > 0 && (
                  <> · handoff: {a.handoffKeywords.join(', ')}</>
                )}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
