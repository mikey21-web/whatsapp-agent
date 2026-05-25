'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatRelative } from '@/lib/utils';
import { Plus, RefreshCw, Trash } from 'lucide-react';

interface Account {
  id: string;
  provider: 'EVOLUTION' | 'META_CLOUD';
  phoneNumber: string;
  displayName: string | null;
  wabaId: string | null;
}

interface Template {
  id: string;
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DISABLED';
  components: any[];
  rejectionReason: string | null;
  updatedAt: string;
}

interface Component {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  buttons?: { type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'; text: string; url?: string; phone_number?: string }[];
}

const STATUS_COLORS: Record<Template['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  PAUSED: 'bg-slate-100 text-slate-800',
  DISABLED: 'bg-slate-100 text-slate-800',
};

export default function TemplatesPage() {
  const qc = useQueryClient();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const { data: accounts } = useQuery({
    queryKey: ['whatsapp-accounts'],
    queryFn: () => api<Account[]>('/whatsapp/accounts'),
  });

  const cloudAccounts = useMemo(
    () => (accounts ?? []).filter((a) => a.provider === 'META_CLOUD'),
    [accounts],
  );

  useEffect(() => {
    if (!accountId && cloudAccounts.length > 0) setAccountId(cloudAccounts[0]!.id);
  }, [cloudAccounts, accountId]);

  const { data: templates } = useQuery({
    queryKey: ['templates', accountId],
    queryFn: () => api<Template[]>(`/whatsapp/accounts/${accountId}/templates`),
    enabled: !!accountId,
    refetchInterval: 30_000,
  });

  const sync = useMutation({
    mutationFn: () => api(`/whatsapp/accounts/${accountId}/templates/sync`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates', accountId] }),
  });

  if (cloudAccounts.length === 0) {
    return (
      <div className="h-full overflow-auto p-6">
        <h1 className="mb-2 text-2xl font-semibold">Message Templates</h1>
        <p className="text-sm text-muted-foreground">
          Templates are required by Meta WhatsApp Cloud API for marketing and utility messages
          sent outside the 24-hour service window.
        </p>
        <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
          You don't have a Meta Cloud account connected yet. Connect one from Settings →
          WhatsApp accounts to manage templates.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <header className="mb-6 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Message Templates</h1>
          <p className="text-sm text-muted-foreground">
            Templates require Meta approval. Pending → Approved typically takes a few minutes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-10 rounded-md border border-border bg-transparent px-2 text-sm"
            value={accountId ?? ''}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {cloudAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName ?? a.phoneNumber}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
            <RefreshCw size={14} className="mr-1" />
            {sync.isPending ? 'Syncing…' : 'Sync from Meta'}
          </Button>
          <Button size="sm" onClick={() => setShowEditor(true)}>
            <Plus size={14} className="mr-1" /> New template
          </Button>
        </div>
      </header>

      <div className="space-y-2">
        {templates?.length === 0 && (
          <p className="text-sm text-muted-foreground">No templates yet for this account.</p>
        )}
        {templates?.map((t) => (
          <TemplateRow key={t.id} t={t} />
        ))}
      </div>

      {showEditor && accountId && (
        <TemplateEditor
          accountId={accountId}
          onClose={() => setShowEditor(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['templates', accountId] });
            setShowEditor(false);
          }}
        />
      )}
    </div>
  );
}

function TemplateRow({ t }: { t: Template }) {
  const body = (t.components || []).find((c: any) => c.type === 'BODY')?.text ?? '';
  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm">{t.name}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{t.language}</span>
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{t.category}</span>
            <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_COLORS[t.status]}`}>{t.status}</span>
          </div>
          <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{body}</p>
          {t.rejectionReason && (
            <p className="mt-2 text-xs text-red-700">Rejected: {t.rejectionReason}</p>
          )}
        </div>
        <div className="text-right text-xs text-muted-foreground">
          {formatRelative(t.updatedAt)}
        </div>
      </div>
    </div>
  );
}

function TemplateEditor({
  accountId, onClose, onCreated,
}: {
  accountId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('en');
  const [category, setCategory] = useState<'MARKETING' | 'UTILITY' | 'AUTHENTICATION'>('UTILITY');
  const [headerText, setHeaderText] = useState('');
  const [body, setBody] = useState('Hi {{1}}, your order {{2}} is confirmed.');
  const [footerText, setFooterText] = useState('');
  const [buttonText, setButtonText] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => {
      const components: Component[] = [];
      if (headerText) components.push({ type: 'HEADER', format: 'TEXT', text: headerText });
      components.push({ type: 'BODY', text: body });
      if (footerText) components.push({ type: 'FOOTER', text: footerText });
      if (buttonText) {
        const button = buttonUrl
          ? { type: 'URL' as const, text: buttonText, url: buttonUrl }
          : { type: 'QUICK_REPLY' as const, text: buttonText };
        components.push({ type: 'BUTTONS', buttons: [button] });
      }
      return api(`/whatsapp/accounts/${accountId}/templates`, {
        method: 'POST',
        json: { name, language, category, components },
      });
    },
    onSuccess: onCreated,
    onError: (e) => setError(e instanceof Error ? e.message : 'Failed'),
  });

  const variableCount = (body.match(/\{\{\d+\}\}/g) ?? []).length;
  const validName = /^[a-z0-9_]{1,512}$/.test(name);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-border bg-background shadow-lg">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold">New template</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">×</button>
        </header>

        <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-2">
          <div className="space-y-3 overflow-y-auto p-4">
            <Field label="Name (lowercase, underscores only)">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                placeholder="order_confirmed"
              />
              {!validName && name && (
                <p className="mt-1 text-xs text-red-600">Use a-z, 0-9, _ only</p>
              )}
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Language">
                <select
                  className="h-10 w-full rounded-md border border-border bg-transparent px-2 text-sm"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                >
                  <option value="en">English (en)</option>
                  <option value="en_US">English US (en_US)</option>
                  <option value="hi">Hindi (hi)</option>
                  <option value="te">Telugu (te)</option>
                  <option value="ta">Tamil (ta)</option>
                </select>
              </Field>
              <Field label="Category">
                <select
                  className="h-10 w-full rounded-md border border-border bg-transparent px-2 text-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                >
                  <option value="UTILITY">Utility</option>
                  <option value="MARKETING">Marketing</option>
                  <option value="AUTHENTICATION">Authentication</option>
                </select>
              </Field>
            </div>

            <Field label="Header (optional)">
              <Input
                placeholder="Welcome to Acme!"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
              />
            </Field>

            <Field label={`Body (${variableCount} variable${variableCount === 1 ? '' : 's'})`}>
              <textarea
                className="min-h-[120px] w-full rounded-md border border-border bg-transparent p-2 text-sm"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Use <code className="rounded bg-muted px-1">{'{{1}}'}</code>,{' '}
                <code className="rounded bg-muted px-1">{'{{2}}'}</code> for variables.
              </p>
            </Field>

            <Field label="Footer (optional)">
              <Input
                placeholder="Reply STOP to unsubscribe."
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                maxLength={60}
              />
            </Field>

            <Field label="Single button (optional)">
              <div className="space-y-2">
                <Input
                  placeholder="Button text (e.g. Track order)"
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  maxLength={25}
                />
                {buttonText && (
                  <Input
                    placeholder="URL (leave empty for quick reply)"
                    value={buttonUrl}
                    onChange={(e) => setButtonUrl(e.target.value)}
                  />
                )}
              </div>
            </Field>
          </div>

          <aside className="space-y-3 overflow-y-auto border-l border-border bg-muted/20 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview</h3>
            <div className="mx-auto w-full max-w-sm rounded-2xl bg-[#dcf8c6] p-3 text-sm shadow-sm">
              {headerText && <div className="mb-2 font-semibold">{headerText}</div>}
              <div className="whitespace-pre-wrap">{body}</div>
              {footerText && <div className="mt-2 text-xs text-muted-foreground">{footerText}</div>}
              {buttonText && (
                <div className="mt-3 rounded-md bg-white p-2 text-center text-sm text-blue-600">
                  {buttonText}
                </div>
              )}
            </div>
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              Meta reviews templates against their content policy. Marketing templates take longer
              to approve. Avoid promotional language without recipient opt-in.
            </div>
          </aside>
        </div>

        <footer className="flex items-center justify-between border-t border-border px-4 py-3">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => create.mutate()}
              disabled={!validName || !body || create.isPending}
            >
              {create.isPending ? 'Submitting…' : 'Submit for approval'}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
