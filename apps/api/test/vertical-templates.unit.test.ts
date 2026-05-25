import { describe, expect, it } from 'vitest';
import { VERTICAL_TEMPLATES } from '../src/template/vertical-templates';

describe('Vertical templates', () => {
  const verticals = [
    'REAL_ESTATE', 'CLINIC', 'COACHING', 'D2C',
    'HOSPITALITY', 'EDUCATION', 'FINANCE', 'GENERAL',
  ] as const;

  it('defines all 8 verticals from the spec', () => {
    for (const v of verticals) {
      expect(VERTICAL_TEMPLATES[v]).toBeDefined();
    }
  });

  it('every template has a non-empty agent', () => {
    for (const v of verticals) {
      const t = VERTICAL_TEMPLATES[v];
      expect(t.agent.name.length).toBeGreaterThan(0);
      expect(t.agent.persona.length).toBeGreaterThan(0);
      expect(t.agent.systemPrompt.length).toBeGreaterThan(20);
      expect(t.agent.language.length).toBeGreaterThan(0);
    }
  });

  it('every template has a pipeline with at least 3 stages', () => {
    for (const v of verticals) {
      const t = VERTICAL_TEMPLATES[v];
      expect(t.pipeline.name.length).toBeGreaterThan(0);
      expect(t.pipeline.stages.length).toBeGreaterThanOrEqual(3);
      for (const s of t.pipeline.stages) {
        expect(s.name.length).toBeGreaterThan(0);
        expect(s.color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('stage names are unique within each pipeline', () => {
    for (const v of verticals) {
      const names = VERTICAL_TEMPLATES[v].pipeline.stages.map((s) => s.name);
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it('every flow has a TRIGGER and END node', () => {
    for (const v of verticals) {
      for (const f of VERTICAL_TEMPLATES[v].flows) {
        const kinds = f.doc.nodes.map((n) => n.kind);
        expect(kinds).toContain('TRIGGER');
        expect(kinds).toContain('END');
      }
    }
  });

  it('every flow has at least one edge', () => {
    for (const v of verticals) {
      for (const f of VERTICAL_TEMPLATES[v].flows) {
        expect(f.doc.edges.length).toBeGreaterThan(0);
      }
    }
  });
});
