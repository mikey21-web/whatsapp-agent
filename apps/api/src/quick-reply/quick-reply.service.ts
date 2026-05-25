import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Principal } from '../auth/principal';

@Injectable()
export class QuickReplyService {
  constructor(private readonly prisma: PrismaService) {}

  list(p: Principal) {
    return this.prisma.quickReply.findMany({
      where: { clientId: clientOf(p) },
      orderBy: { shortcut: 'asc' },
    });
  }

  async create(dto: { shortcut: string; body: string }, p: Principal) {
    const clientId = clientOf(p);
    return this.prisma.quickReply.create({
      data: {
        clientId,
        shortcut: normalizeShortcut(dto.shortcut),
        body: dto.body,
        createdBy: p.type === 'TEAM_MEMBER' ? p.id : null,
      },
    });
  }

  async update(id: string, dto: { shortcut?: string; body?: string }, p: Principal) {
    const r = await this.prisma.quickReply.findUnique({ where: { id } });
    if (!r || r.clientId !== clientOf(p)) throw new NotFoundException();
    return this.prisma.quickReply.update({
      where: { id },
      data: {
        ...(dto.shortcut ? { shortcut: normalizeShortcut(dto.shortcut) } : {}),
        ...(dto.body ? { body: dto.body } : {}),
      },
    });
  }

  async remove(id: string, p: Principal) {
    const r = await this.prisma.quickReply.findUnique({ where: { id } });
    if (!r || r.clientId !== clientOf(p)) throw new NotFoundException();
    await this.prisma.quickReply.delete({ where: { id } });
    return { ok: true };
  }
}

function normalizeShortcut(s: string): string {
  return s.trim().toLowerCase().replace(/^\/+/, '');
}

function clientOf(p: Principal): string {
  if (p.type === 'CLIENT') return p.id;
  if (p.type === 'TEAM_MEMBER') return p.clientId;
  throw new ForbiddenException();
}
