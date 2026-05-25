import { describe, expect, it } from 'vitest';

const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

function chunk(text: string): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (clean.length === 0) return [];
  if (clean.length <= CHUNK_SIZE) return [clean];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + CHUNK_SIZE, clean.length);
    if (end < clean.length) {
      const tail = clean.slice(i, end);
      const lastBreak = Math.max(
        tail.lastIndexOf('\n\n'),
        tail.lastIndexOf('. '),
        tail.lastIndexOf('? '),
        tail.lastIndexOf('! '),
      );
      if (lastBreak > CHUNK_SIZE / 2) end = i + lastBreak + 1;
    }
    chunks.push(clean.slice(i, end).trim());
    const next = end - CHUNK_OVERLAP;
    i = next > i ? next : end;
  }
  return chunks.filter((c) => c.length > 0);
}

describe('RAG chunker', () => {
  it('returns single chunk for short input', () => {
    expect(chunk('Hello world')).toEqual(['Hello world']);
  });

  it('returns empty array for whitespace-only input', () => {
    expect(chunk('   \n\n  ')).toEqual([]);
  });

  it('handles input exactly at chunk size', () => {
    const text = 'x'.repeat(CHUNK_SIZE);
    expect(chunk(text)).toEqual([text]);
  });

  it('splits long input into multiple chunks', () => {
    const para = 'This is sentence one. ';
    const text = para.repeat(200);
    const result = chunk(text);
    expect(result.length).toBeGreaterThan(1);
    result.forEach((c) => expect(c.length).toBeLessThanOrEqual(CHUNK_SIZE + 1));
  });

  it('preserves all content across overlapping chunks', () => {
    const text = 'A '.repeat(800) + 'B '.repeat(800);
    const result = chunk(text);
    const joined = result.join(' ');
    expect(joined).toContain('A A A A A');
    expect(joined).toContain('B B B B B');
  });

  it('makes forward progress on tricky inputs', () => {
    // Long input without sentence boundaries — should still terminate.
    const text = 'x'.repeat(5000);
    const result = chunk(text);
    expect(result.length).toBeGreaterThan(1);
    expect(result.length).toBeLessThan(20);
  });

  it('handles \\r\\n line endings', () => {
    const text = 'Hello.\r\nWorld.\r\n'.repeat(100);
    const result = chunk(text);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((c) => c.includes('\r'))).toBe(false);
  });
});
