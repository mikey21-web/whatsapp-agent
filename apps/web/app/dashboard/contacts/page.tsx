'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ContactDTO } from '@diyaa/types';
import { formatRelative } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

export default function ContactsPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => api<ContactDTO[]>('/contacts'),
  });

  const importMut = useMutation({
    mutationFn: (csv: string) =>
      api<ImportResult>('/contacts/import', { method: 'POST', json: { csv } }),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  function onFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => importMut.mutate(String(reader.result ?? ''));
    reader.readAsText(file);
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Contacts</h1>
        <div className="flex items-center gap-2">
          <a
            href="data:text/csv;charset=utf-8,phone,name,email,tags,language%0A919999988888,Asha,asha@example.com,vip%3Bnewsletter,en"
            download="contacts-template.csv"
            className="text-xs text-muted-foreground underline"
          >
            CSV template
          </a>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.currentTarget.value = '';
            }}
          />
          <Button
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={importMut.isPending}
          >
            <Upload size={14} className="mr-1" />
            {importMut.isPending ? 'Importing…' : 'Import CSV'}
          </Button>
        </div>
      </div>

      {result && (
        <div className="mb-4 rounded-md border border-border bg-muted/30 p-3 text-sm">
          Imported {result.created} new, updated {result.updated}, skipped {result.skipped} of{' '}
          {result.total} rows.
          {result.errors.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                {result.errors.length} error{result.errors.length === 1 ? '' : 's'}
              </summary>
              <ul className="mt-2 space-y-0.5 text-xs">
                {result.errors.slice(0, 20).map((e, i) => (
                  <li key={i}>row {e.row}: {e.reason}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      <div className="rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left">
            <tr>
              <th className="p-2">Name</th>
              <th className="p-2">Phone</th>
              <th className="p-2">Email</th>
              <th className="p-2">Tags</th>
              <th className="p-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-2">{c.name ?? '—'}</td>
                <td className="p-2 font-mono">{c.phone}</td>
                <td className="p-2">{c.email ?? '—'}</td>
                <td className="p-2 text-xs text-muted-foreground">
                  {c.tags?.join(', ') || '—'}
                </td>
                <td className="p-2 text-muted-foreground">{formatRelative(c.createdAt)}</td>
              </tr>
            ))}
            {data && data.length === 0 && (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={5}>
                  No contacts yet. Import a CSV or wait for inbound WhatsApp messages.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
