'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ReactFlow, {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Connection,
  Controls,
  Edge,
  MarkerType,
  Node,
  NodeChange,
  EdgeChange,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ChevronLeft, MessageSquare, GitBranch, Clock, Tag, UserPlus,
  Bot, Globe, Briefcase, User2, Zap, X,
} from 'lucide-react';

interface FlowDoc {
  nodes: { id: string; kind: string; data: Record<string, unknown>; position?: { x: number; y: number } }[];
  edges: { id: string; source: string; target: string; branch?: 'true' | 'false' }[];
}
interface FlowRecord {
  id: string;
  name: string;
  trigger: string;
  isActive: boolean;
  nodes: FlowDoc['nodes'];
  edges: FlowDoc['edges'];
}

const NODE_KINDS = [
  { kind: 'SEND_MESSAGE', label: 'Send Message', icon: MessageSquare, color: '#6366f1' },
  { kind: 'CONDITION', label: 'Condition', icon: GitBranch, color: '#f59e0b' },
  { kind: 'DELAY', label: 'Delay', icon: Clock, color: '#0ea5e9' },
  { kind: 'ADD_TAG', label: 'Add Tag', icon: Tag, color: '#16a34a' },
  { kind: 'REMOVE_TAG', label: 'Remove Tag', icon: Tag, color: '#dc2626' },
  { kind: 'ASSIGN', label: 'Assign Conversation', icon: UserPlus, color: '#8b5cf6' },
  { kind: 'AI_RESPOND', label: 'AI Respond', icon: Bot, color: '#06b6d4' },
  { kind: 'WEBHOOK', label: 'Webhook', icon: Globe, color: '#6b7280' },
  { kind: 'CREATE_DEAL', label: 'Create Deal', icon: Briefcase, color: '#16a34a' },
  { kind: 'UPDATE_CONTACT', label: 'Update Contact', icon: User2, color: '#9333ea' },
  { kind: 'END', label: 'End', icon: Zap, color: '#475569' },
] as const;

const KIND_META = Object.fromEntries(NODE_KINDS.map((n) => [n.kind, n]));

function FlowEditorInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['flow', params.id],
    queryFn: () => api<FlowRecord>(`/flows/${params.id}`),
  });

  useEffect(() => {
    if (!data) return;
    setName(data.name);
    setNodes(
      data.nodes.map((n) => ({
        id: n.id,
        type: 'default',
        position: n.position ?? { x: 100, y: 100 },
        data: { label: nodeLabel(n.kind, n.data), kind: n.kind, fields: n.data },
        style: nodeStyle(n.kind),
      })),
    );
    setEdges(
      data.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.branch,
        markerEnd: { type: MarkerType.ArrowClosed },
        data: { branch: e.branch },
      })),
    );
  }, [data]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );
  const onConnect = useCallback(
    (c: Connection) =>
      setEdges((eds) =>
        addEdge({ ...c, markerEnd: { type: MarkerType.ArrowClosed } }, eds),
      ),
    [],
  );

  function addNode(kind: string) {
    const id = `n_${Math.random().toString(36).slice(2, 8)}`;
    setNodes((ns) => [
      ...ns,
      {
        id,
        type: 'default',
        position: { x: 250 + ns.length * 30, y: 150 + ns.length * 30 },
        data: { label: nodeLabel(kind, {}), kind, fields: {} },
        style: nodeStyle(kind),
      },
    ]);
  }

  const save = useMutation({
    mutationFn: (payload: { name: string; doc: FlowDoc; isActive?: boolean }) =>
      api(`/flows/${params.id}`, { method: 'PATCH', json: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['flows'] }),
  });

  function persist(opts: { activate?: boolean } = {}) {
    const doc: FlowDoc = {
      nodes: nodes.map((n) => ({
        id: n.id,
        kind: (n.data as any).kind,
        data: ((n.data as any).fields as Record<string, unknown>) ?? {},
        position: n.position,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        branch: ((e.data as any)?.branch ?? (e.label as string)) as 'true' | 'false' | undefined,
      })),
    };
    save.mutate({
      name,
      doc,
      ...(opts.activate !== undefined ? { isActive: opts.activate } : {}),
    });
  }

  const selected = nodes.find((n) => n.id === selectedId);

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading flow…</div>;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/flows')}>
            <ChevronLeft size={16} />
          </Button>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-72"
          />
          <span className="text-xs text-muted-foreground">trigger: {data?.trigger}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => persist()}>
            {save.isPending ? 'Saving…' : 'Save draft'}
          </Button>
          <Button size="sm" onClick={() => persist({ activate: true })}>
            Save & activate
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-56 flex-col gap-1 overflow-y-auto border-r border-border p-3">
          <h3 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Nodes
          </h3>
          {NODE_KINDS.map((n) => (
            <button
              key={n.kind}
              onClick={() => addNode(n.kind)}
              className="flex items-center gap-2 rounded-md border border-border px-2 py-2 text-left text-sm hover:bg-muted"
            >
              <n.icon size={14} style={{ color: n.color }} />
              <span>{n.label}</span>
            </button>
          ))}
        </aside>

        <div className="relative flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => setSelectedId(n.id)}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        {selected && (
          <NodeInspector
            node={selected}
            onClose={() => setSelectedId(null)}
            onChange={(fields) =>
              setNodes((ns) =>
                ns.map((n) =>
                  n.id === selected.id
                    ? {
                        ...n,
                        data: {
                          ...n.data,
                          fields,
                          label: nodeLabel((n.data as any).kind, fields),
                        },
                      }
                    : n,
                ),
              )
            }
            onDelete={() => {
              setNodes((ns) => ns.filter((n) => n.id !== selected.id));
              setEdges((es) => es.filter((e) => e.source !== selected.id && e.target !== selected.id));
              setSelectedId(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

export default function FlowEditorPage() {
  return (
    <ReactFlowProvider>
      <FlowEditorInner />
    </ReactFlowProvider>
  );
}

function NodeInspector({
  node,
  onClose,
  onChange,
  onDelete,
}: {
  node: Node;
  onClose: () => void;
  onChange: (fields: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const kind = (node.data as any).kind as string;
  const fields = ((node.data as any).fields as Record<string, unknown>) ?? {};
  const meta = (KIND_META as any)[kind];

  function set(k: string, v: unknown) {
    onChange({ ...fields, [k]: v });
  }

  return (
    <aside className="flex w-80 flex-col border-l border-border bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium">
          {meta?.icon && <meta.icon size={14} style={{ color: meta.color }} />}
          <span>{meta?.label ?? kind}</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-3 text-sm">
        {kind === 'SEND_MESSAGE' && (
          <Field label="Message">
            <textarea
              className="min-h-[100px] w-full rounded-md border border-border bg-transparent p-2"
              value={String(fields.text ?? '')}
              onChange={(e) => set('text', e.target.value)}
              placeholder="Hi {{ vars.name }}, …"
            />
          </Field>
        )}

        {kind === 'CONDITION' && (
          <>
            <Field label="Left">
              <Input value={String(fields.lhs ?? '{{ message }}')} onChange={(e) => set('lhs', e.target.value)} />
            </Field>
            <Field label="Operator">
              <select
                className="w-full rounded-md border border-border bg-transparent p-2"
                value={String(fields.op ?? 'contains')}
                onChange={(e) => set('op', e.target.value)}
              >
                <option value="equals">equals</option>
                <option value="contains">contains</option>
                <option value="starts_with">starts_with</option>
                <option value="regex">regex</option>
              </select>
            </Field>
            <Field label="Right">
              <Input value={String(fields.rhs ?? '')} onChange={(e) => set('rhs', e.target.value)} />
            </Field>
            <p className="text-xs text-muted-foreground">
              On the canvas, label edges leaving this node with <code>true</code> or <code>false</code>.
            </p>
          </>
        )}

        {kind === 'DELAY' && (
          <Field label="Delay (milliseconds, max 60s)">
            <Input
              type="number"
              value={String(fields.ms ?? 1000)}
              onChange={(e) => set('ms', Number(e.target.value))}
            />
          </Field>
        )}

        {(kind === 'ADD_TAG' || kind === 'REMOVE_TAG') && (
          <Field label="Tag">
            <Input value={String(fields.tag ?? '')} onChange={(e) => set('tag', e.target.value)} />
          </Field>
        )}

        {kind === 'ASSIGN' && (
          <Field label="Team member ID (or empty to unassign)">
            <Input
              value={String(fields.teamMemberId ?? '')}
              onChange={(e) => set('teamMemberId', e.target.value || null)}
            />
          </Field>
        )}

        {kind === 'WEBHOOK' && (
          <Field label="URL">
            <Input value={String(fields.url ?? '')} onChange={(e) => set('url', e.target.value)} />
          </Field>
        )}

        {kind === 'CREATE_DEAL' && (
          <>
            <Field label="Pipeline ID">
              <Input value={String(fields.pipelineId ?? '')} onChange={(e) => set('pipelineId', e.target.value)} />
            </Field>
            <Field label="Title">
              <Input value={String(fields.title ?? 'New deal')} onChange={(e) => set('title', e.target.value)} />
            </Field>
          </>
        )}

        {kind === 'UPDATE_CONTACT' && (
          <Field label="Fields (JSON)">
            <textarea
              className="min-h-[80px] w-full rounded-md border border-border bg-transparent p-2 font-mono text-xs"
              value={JSON.stringify(fields.fields ?? {}, null, 2)}
              onChange={(e) => {
                try { set('fields', JSON.parse(e.target.value)); } catch { /* ignore */ }
              }}
            />
          </Field>
        )}

        <Button variant="destructive" size="sm" onClick={onDelete} className="w-full">
          Delete node
        </Button>
      </div>
    </aside>
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

function nodeStyle(kind: string): React.CSSProperties {
  const meta = (KIND_META as any)[kind];
  return {
    background: meta?.color ?? '#475569',
    color: '#fff',
    border: 'none',
    padding: '8px 12px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
  };
}

function nodeLabel(kind: string, data: Record<string, unknown>): string {
  switch (kind) {
    case 'SEND_MESSAGE': {
      const text = String(data.text ?? '');
      return `Send: ${text.slice(0, 24)}${text.length > 24 ? '…' : ''}`;
    }
    case 'CONDITION':
      return `If ${data.op ?? '?'} "${String(data.rhs ?? '')}"`;
    case 'DELAY':
      return `Wait ${data.ms ?? 0}ms`;
    case 'ADD_TAG':
      return `+ tag ${data.tag ?? ''}`;
    case 'REMOVE_TAG':
      return `− tag ${data.tag ?? ''}`;
    default:
      return (KIND_META as any)[kind]?.label ?? kind;
  }
}
