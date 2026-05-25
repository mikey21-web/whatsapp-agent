import { describe, expect, it } from 'vitest';

interface FlowDoc {
  nodes: { id: string; kind: string; data: Record<string, unknown> }[];
  edges: { id: string; source: string; target: string; branch?: 'true' | 'false' }[];
}

function nextNodeId(doc: FlowDoc, fromId: string, branch?: 'true' | 'false'): string | null {
  const candidates = doc.edges.filter((e) => e.source === fromId);
  if (candidates.length === 0) return null;
  if (branch) {
    const branched = candidates.find((e) => e.branch === branch);
    if (branched) return branched.target;
  }
  return candidates[0]!.target;
}

function template(s: string, ctx: { message?: string; vars: Record<string, unknown>; contactId: string }): string {
  return s
    .replace(/\{\{\s*message\s*\}\}/gi, ctx.message ?? '')
    .replace(/\{\{\s*contact\.id\s*\}\}/gi, ctx.contactId)
    .replace(/\{\{\s*vars\.([\w]+)\s*\}\}/gi, (_, k) => String(ctx.vars[k] ?? ''));
}

describe('flow graph traversal', () => {
  const doc: FlowDoc = {
    nodes: [
      { id: 't', kind: 'TRIGGER', data: {} },
      { id: 'cond', kind: 'CONDITION', data: {} },
      { id: 'yes', kind: 'SEND_MESSAGE', data: { text: 'Y' } },
      { id: 'no', kind: 'SEND_MESSAGE', data: { text: 'N' } },
      { id: 'end', kind: 'END', data: {} },
    ],
    edges: [
      { id: 'e1', source: 't', target: 'cond' },
      { id: 'e2', source: 'cond', target: 'yes', branch: 'true' },
      { id: 'e3', source: 'cond', target: 'no', branch: 'false' },
      { id: 'e4', source: 'yes', target: 'end' },
      { id: 'e5', source: 'no', target: 'end' },
    ],
  };

  it('follows linear edges', () => {
    expect(nextNodeId(doc, 't')).toBe('cond');
  });
  it('respects true branch', () => {
    expect(nextNodeId(doc, 'cond', 'true')).toBe('yes');
  });
  it('respects false branch', () => {
    expect(nextNodeId(doc, 'cond', 'false')).toBe('no');
  });
  it('falls back to first edge when branch not specified', () => {
    expect(nextNodeId(doc, 'cond')).toBe('yes');
  });
  it('returns null at terminal node', () => {
    expect(nextNodeId(doc, 'end')).toBeNull();
  });
  it('returns null for unknown node', () => {
    expect(nextNodeId(doc, 'nonexistent')).toBeNull();
  });
});

describe('flow template variables', () => {
  it('substitutes {{ message }}', () => {
    const r = template('Hello {{ message }}', { message: 'World', vars: {}, contactId: 'c1' });
    expect(r).toBe('Hello World');
  });
  it('substitutes {{ contact.id }}', () => {
    const r = template('Contact: {{ contact.id }}', { vars: {}, contactId: 'c123' });
    expect(r).toBe('Contact: c123');
  });
  it('substitutes vars.<name>', () => {
    const r = template('Hi {{ vars.name }}', { vars: { name: 'Asha' }, contactId: 'c1' });
    expect(r).toBe('Hi Asha');
  });
  it('handles missing vars gracefully', () => {
    const r = template('Hi {{ vars.missing }}', { vars: {}, contactId: 'c1' });
    expect(r).toBe('Hi ');
  });
  it('substitutes multiple variables', () => {
    const r = template('{{ vars.name }} from {{ vars.city }}', {
      vars: { name: 'Ravi', city: 'Bengaluru' },
      contactId: 'c1',
    });
    expect(r).toBe('Ravi from Bengaluru');
  });
});
