import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { FlowTrigger, Prisma } from '@diyaa/db';
import { PrismaService } from '../prisma/prisma.service';
import type { Principal } from '../auth/principal';
import type { FlowDoc } from './flow.types';

@Injectable()
export class FlowService {
  constructor(private readonly prisma: PrismaService) {}

  list(p: Principal) {
    return this.prisma.flow.findMany({
      where: { clientId: clientOf(p) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string, p: Principal) {
    const f = await this.prisma.flow.findUnique({ where: { id } });
    if (!f || f.clientId !== clientOf(p)) throw new NotFoundException();
    return f;
  }

  async create(
    dto: { name: string; trigger: FlowTrigger; doc: FlowDoc; isActive?: boolean },
    p: Principal,
  ) {
    return this.prisma.flow.create({
      data: {
        clientId: clientOf(p),
        name: dto.name,
        trigger: dto.trigger,
        nodes: dto.doc.nodes as unknown as Prisma.InputJsonValue,
        edges: dto.doc.edges as unknown as Prisma.InputJsonValue,
        isActive: dto.isActive ?? false,
      },
    });
  }

  async update(
    id: string,
    dto: { name?: string; doc?: FlowDoc; isActive?: boolean },
    p: Principal,
  ) {
    await this.get(id, p);
    return this.prisma.flow.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.doc
          ? {
              nodes: dto.doc.nodes as unknown as Prisma.InputJsonValue,
              edges: dto.doc.edges as unknown as Prisma.InputJsonValue,
            }
          : {}),
      },
    });
  }

  async remove(id: string, p: Principal) {
    await this.get(id, p);
    await this.prisma.flow.delete({ where: { id } });
    return { ok: true };
  }
}

function clientOf(p: Principal): string {
  if (p.type === 'CLIENT') return p.id;
  if (p.type === 'TEAM_MEMBER') return p.clientId;
  throw new ForbiddenException();
}
