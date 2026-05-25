'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface KB {
  id: string;
  name: string;
  _count?: { documents: number };
}
interface Doc {
  id: string;
  title: string;
  createdAt: string;
}

export default function KnowledgePage() {
  const qc = useQueryClient();
  const [active, setActive] = useState<string | null>(null);
  const [newKb, setNewKb] = useState('');

  const { data: kbs } = useQuery({
    queryKey: ['kbs'],
    queryFn: () => api<KB[]>('/knowledge-bases'),
  });

  const createKb = useMutation({
    mutationFn: () => api<KB>('/knowledge-bases', { method: 'POST', json: { name: newKb } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kbs'] });
      setNewKb('');
    },
  });

  return (
    <div className="flex h-full">
      <aside className="w-64 border-r border-border p-4">
        <h2 className="mb-3 font-semibold">Knowledge bases</h2>
        <div className="mb-4 flex gap-2">
          <Input
            placeholder="New KB name"
            value={newKb}
            onChange={(e) => setNewKb(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!newKb || createKb.isPending}
            onClick={() => createKb.mutate()}
          >
            +
          </Button>
        </div>
        <ul className="space-y-1">
          {kbs?.map((k) => (
            <li key={k.id}>
              <button
                onClick={() => setActive(k.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${active === k.id ? 'bg-muted' : ''}`}
              >
                <div className="font-medium">{k.name}</div>
                <div className="text-xs text-muted-foreground">
                  {k._count?.documents ?? 0} chunks
                </div>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        {active ? <KbDetail kbId={active} /> : <p className="text-muted-foreground">Pick a KB.</p>}
      </main>
    </div>
  );
}

function KbDetail({ kbId }: { kbId: string }) {
  const qc = useQueryClient();
  const { data: docs } = useQuery({
    queryKey: ['kb', kbId, 'docs'],
    queryFn: () => api<Doc[]>(`/knowledge-bases/${kbId}/documents`),
  });
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [testQuery, setTestQuery] = useState('');
  const [results, setResults] = useState<{ id: string; title: string; content: string; score: number }[]>([]);

  const addDoc = useMutation({
    mutationFn: () =>
      api(`/knowledge-bases/${kbId}/documents`, {
        method: 'POST',
        json: { title, content },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb', kbId, 'docs'] });
      qc.invalidateQueries({ queryKey: ['kbs'] });
      setTitle('');
      setContent('');
    },
  });

  const removeDoc = useMutation({
    mutationFn: (docId: string) =>
      api(`/knowledge-bases/${kbId}/documents/${docId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kb', kbId, 'docs'] }),
  });

  async function runTest() {
    const r = await api<typeof results>(`/knowledge-bases/${kbId}/test?q=${encodeURIComponent(testQuery)}`);
    setResults(r);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-md border border-border p-4">
        <h2 className="font-semibold">Add document</h2>
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          className="min-h-[180px] w-full rounded-md border border-border bg-transparent p-2 text-sm"
          placeholder="Paste FAQ, product info, policies, scripts…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <Button
          onClick={() => addDoc.mutate()}
          disabled={!title || !content || addDoc.isPending}
        >
          {addDoc.isPending ? 'Embedding…' : 'Add document'}
        </Button>
      </div>

      <div className="space-y-3 rounded-md border border-border p-4">
        <h2 className="font-semibold">Test retrieval</h2>
        <div className="flex gap-2">
          <Input
            placeholder="Ask a question…"
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
          />
          <Button onClick={runTest} disabled={!testQuery}>
            Search
          </Button>
        </div>
        {results.map((r) => (
          <div key={r.id} className="rounded-md border border-border p-3 text-sm">
            <div className="mb-1 flex justify-between font-medium">
              <span>{r.title}</span>
              <span className="text-xs text-muted-foreground">
                {(r.score * 100).toFixed(1)}%
              </span>
            </div>
            <p className="line-clamp-4 text-xs text-muted-foreground">{r.content}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Documents</h2>
        <div className="space-y-1 text-sm">
          {docs?.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-md border border-border px-3 py-2"
            >
              <span>{d.title}</span>
              <Button variant="ghost" size="sm" onClick={() => removeDoc.mutate(d.id)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
