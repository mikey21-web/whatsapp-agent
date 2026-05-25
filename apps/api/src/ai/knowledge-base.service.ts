import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Principal } from '../auth/principal';
import { RagService } from './rag.service';

@Injectable()
export class KnowledgeBaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rag: RagService,
  ) {}

  list(p: Principal) {
    return this.prisma.knowledgeBase.findMany({
      where: { clientId: requireClient(p) },
      include: { _count: { select: { documents: true } } },
      orderBy: { id: 'asc' },
    });
  }

  async create(dto: { name: string }, p: Principal) {
    return this.prisma.knowledgeBase.create({
      data: { clientId: requireClient(p), name: dto.name },
    });
  }

  async remove(id: string, p: Principal) {
    const kb = await this.prisma.knowledgeBase.findUnique({ where: { id } });
    if (!kb || kb.clientId !== requireClient(p)) throw new NotFoundException();
    await this.prisma.knowledgeBase.delete({ where: { id } });
    return { ok: true };
  }

  async listDocuments(id: string, p: Principal) {
    await this.requireKb(id, p);
    return this.prisma.kBDocument.findMany({
      where: { knowledgeBaseId: id },
      select: { id: true, title: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addDocument(id: string, dto: { title: string; content: string }, p: Principal) {
    await this.requireKb(id, p);
    return this.rag.ingest({
      knowledgeBaseId: id,
      title: dto.title,
      content: dto.content,
    });
  }

  async removeDocument(kbId: string, docId: string, p: Principal) {
    await this.requireKb(kbId, p);
    const doc = await this.prisma.kBDocument.findUnique({ where: { id: docId } });
    if (!doc || doc.knowledgeBaseId !== kbId) throw new NotFoundException();
    await this.prisma.kBDocument.delete({ where: { id: docId } });
    return { ok: true };
  }

  async test(id: string, query: string, p: Principal) {
    await this.requireKb(id, p);
    return this.rag.retrieve(id, query, 5);
  }

  private async requireKb(id: string, p: Principal) {
    const kb = await this.prisma.knowledgeBase.findUnique({ where: { id } });
    if (!kb || kb.clientId !== requireClient(p)) throw new NotFoundException();
    return kb;
  }
}

function requireClient(p: Principal): string {
  if (p.type === 'CLIENT') return p.id;
  if (p.type === 'TEAM_MEMBER') return p.clientId;
  throw new ForbiddenException();
}
