'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface QuickReply {
  id: string;
  shortcut: string;
  body: string;
}

export default function QuickRepliesPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['quick-replies'],
    queryFn: () => api<QuickReply[]>('/quick-replies'),
  });

  const [shortcut, setShortcut] = useState('');
  const [body, setBody] = useState('');

  const create = useMutation({
    mutationFn: () => api('/quick-replies', { method: 'POST', json: { shortcut, body } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quick-replies'] });
      setShortcut('');
      setBody('');
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/quick-replies/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quick-replies'] }),
  });

  return (
    <div className="h-full overflow-auto p-6">
      <h1 className="mb-2 text-2xl font-semibold">Quick Replies</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Save canned responses. Type <code className="rounded bg-muted px-1">/shortcut</code> in the
        inbox composer to expand the body.
      </p>

      <div className="mb-6 grid gap-2 rounded-md border border-border p-4 md:grid-cols-[160px_1fr_auto] md:items-end">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Shortcut</label>
          <Input
            placeholder="hours"
            value={shortcut}
            onChange={(e) => setShortcut(e.target.value.replace(/^\/+/, ''))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Body</label>
          <Input
            placeholder="We're open Mon–Sat, 10am to 7pm."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <Button
          disabled={!shortcut || !body || create.isPending}
          onClick={() => create.mutate()}
        >
          Save
        </Button>
      </div>

      <div className="space-y-2">
        {data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No quick replies yet.</p>
        )}
        {data?.map((q) => (
          <div
            key={q.id}
            className="flex items-start justify-between rounded-md border border-border p-3 text-sm"
          >
            <div>
              <div className="font-mono text-xs text-[var(--brand)]">/{q.shortcut}</div>
              <div className="mt-1">{q.body}</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => remove.mutate(q.id)}>
              Delete
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
