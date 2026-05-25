import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Principal } from '../auth/principal';

interface CsvRow {
  phone?: string;
  name?: string;
  email?: string;
  tags?: string;
  language?: string;
}

export interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  list(principal: Principal, query: { search?: string; take?: number; skip?: number; tag?: string }) {
    const clientId = this.requireClient(principal);
    const take = Math.min(query.take ?? 50, 200);
    const skip = query.skip ?? 0;
    return this.prisma.contact.findMany({
      where: {
        clientId,
        ...(query.tag ? { tags: { has: query.tag } } : {}),
        ...(query.search
          ? {
              OR: [
                { phone: { contains: query.search } },
                { name: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
  }

  async get(id: string, principal: Principal) {
    const clientId = this.requireClient(principal);
    const c = await this.prisma.contact.findUnique({ where: { id } });
    if (!c || c.clientId !== clientId) throw new NotFoundException();
    return c;
  }

  /**
   * CSV bulk import. Accepts raw CSV text. Tolerates BOM and quoted fields.
   * Required column: phone. Optional: name, email, tags (semicolon-separated), language.
   * Upserts on (clientId, phone).
   */
  async importCsv(principal: Principal, csv: string): Promise<ImportResult> {
    const clientId = this.requireClient(principal);
    const rows = parseCsv(csv);
    const result: ImportResult = { total: rows.length, created: 0, updated: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const phone = (row.phone ?? '').replace(/\D/g, '');
      if (!phone) {
        result.skipped++;
        result.errors.push({ row: i + 2, reason: 'missing phone' });
        continue;
      }
      const tags = (row.tags ?? '')
        .split(/[;|,]/)
        .map((t) => t.trim())
        .filter(Boolean);
      try {
        const existing = await this.prisma.contact.findUnique({
          where: { clientId_phone: { clientId, phone } },
          select: { id: true, tags: true },
        });
        if (existing) {
          await this.prisma.contact.update({
            where: { id: existing.id },
            data: {
              name: row.name || undefined,
              email: row.email || undefined,
              language: row.language || undefined,
              tags: tags.length ? { set: dedupe([...existing.tags, ...tags]) } : undefined,
            },
          });
          result.updated++;
        } else {
          await this.prisma.contact.create({
            data: {
              clientId,
              phone,
              name: row.name || null,
              email: row.email || null,
              language: row.language || 'en',
              tags,
            },
          });
          result.created++;
        }
      } catch (e) {
        result.skipped++;
        result.errors.push({ row: i + 2, reason: (e as Error).message.slice(0, 120) });
      }
    }
    return result;
  }

  private requireClient(p: Principal): string {
    if (p.type === 'CLIENT') return p.id;
    if (p.type === 'TEAM_MEMBER') return p.clientId;
    throw new ForbiddenException();
  }
}

function dedupe(xs: string[]): string[] {
  return Array.from(new Set(xs.map((x) => x.trim()).filter(Boolean)));
}

/**
 * Minimal CSV parser. Handles quoted fields with embedded commas/newlines and
 * doubled quotes, plus optional BOM. First row is the header.
 */
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
        if (text[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cur += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ',') {
      row.push(cur);
      cur = '';
      i++;
      continue;
    }
    if (ch === '\r') {
      i++;
      continue;
    }
    if (ch === '\n') {
      row.push(cur);
      out.push(row);
      cur = '';
      row = [];
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  if (cur.length || row.length) {
    row.push(cur);
    out.push(row);
  }
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
