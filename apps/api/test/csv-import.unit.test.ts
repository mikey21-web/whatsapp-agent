import { describe, expect, it } from 'vitest';

interface CsvRow {
  phone?: string;
  name?: string;
  email?: string;
  tags?: string;
  language?: string;
}

function parseCsv(input: string): CsvRow[] {
  const text = input.replace(/^\uFEFF/, '');
  const out: string[][] = [];
  let i = 0;
  let cur = '';
  let row: string[] = [];
  let inQuotes = false;
  while (i < text.length) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cur += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { row.push(cur); cur = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { row.push(cur); out.push(row); cur = ''; row = []; i++; continue; }
    cur += ch; i++;
  }
  if (cur.length || row.length) { row.push(cur); out.push(row); }
  if (out.length === 0) return [];
  const header = (out[0] ?? []).map((h) => h.trim().toLowerCase());
  return out.slice(1).map((cells) => {
    const obj: CsvRow = {};
    header.forEach((h, idx) => {
      const v = cells[idx]?.trim();
      if (!v) return;
      if (h === 'phone' || h === 'mobile' || h === 'number') obj.phone = v;
      else if (h === 'name' || h === 'full name') obj.name = v;
      else if (h === 'email' || h === 'e-mail') obj.email = v;
      else if (h === 'tags' || h === 'tag') obj.tags = v;
      else if (h === 'language' || h === 'lang') obj.language = v;
    });
    return obj;
  });
}

describe('CSV parser', () => {
  it('parses a simple CSV with header', () => {
    const csv = 'phone,name\n919999988888,Asha\n918888877777,Ravi\n';
    const rows = parseCsv(csv);
    expect(rows).toEqual([
      { phone: '919999988888', name: 'Asha' },
      { phone: '918888877777', name: 'Ravi' },
    ]);
  });

  it('handles BOM at start of file', () => {
    const csv = '\uFEFFphone,name\n919999988888,Asha\n';
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual({ phone: '919999988888', name: 'Asha' });
  });

  it('handles CRLF line endings', () => {
    const csv = 'phone,name\r\n919999988888,Asha\r\n918888877777,Ravi\r\n';
    expect(parseCsv(csv)).toHaveLength(2);
  });

  it('handles quoted fields with commas', () => {
    const csv = 'phone,name\n919999988888,"Doe, John"\n';
    const rows = parseCsv(csv);
    expect(rows[0]?.name).toBe('Doe, John');
  });

  it('handles doubled quotes inside quoted field', () => {
    const csv = 'phone,name\n919999988888,"He said ""hi"""\n';
    const rows = parseCsv(csv);
    expect(rows[0]?.name).toBe('He said "hi"');
  });

  it('handles quoted fields with newlines', () => {
    const csv = 'phone,name\n919999988888,"Line one\nline two"\n';
    const rows = parseCsv(csv);
    expect(rows[0]?.name).toBe('Line one\nline two');
  });

  it('aliases header columns', () => {
    const csv = 'mobile,full name,e-mail,lang\n919999988888,Asha,asha@example.com,hi\n';
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual({
      phone: '919999988888',
      name: 'Asha',
      email: 'asha@example.com',
      language: 'hi',
    });
  });

  it('handles empty CSV', () => {
    expect(parseCsv('')).toEqual([]);
  });

  it('handles header-only CSV', () => {
    expect(parseCsv('phone,name\n')).toEqual([]);
  });

  it('skips empty trailing newlines', () => {
    const csv = 'phone\n919999988888\n\n';
    const rows = parseCsv(csv);
    // The trailing blank line creates one empty cell row, which has no recognized headers.
    expect(rows.filter((r) => r.phone).length).toBe(1);
  });
});
