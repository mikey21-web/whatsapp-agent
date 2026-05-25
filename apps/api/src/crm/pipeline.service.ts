import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Principal } from '../auth/principal';

const DEFAULT_STAGES = [
  { name: 'New', color: '#94a3b8' },
  { name: 'Qualified', color: '#6366f1' },
  { name: 'Proposal', color: '#f59e0b' },
  { name: 'Closed Won', color: '#16a34a' },
  { name: 'Closed Lost', color: '#dc2626' },
];

@Injectable()
export class PipelineService {
  constructor(private readonly prisma: PrismaService) {}

  list(p: Principal) {
    return this.prisma.pipeline.findMany({
      where: { clientId: clientOf(p) },
      include: { stages: { orderBy: { order: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: { name: string; stages?: { name: string; color?: string }[] }, p: Principal) {
    const stages = (dto.stages?.length ? dto.stages : DEFAULT_STAGES).map((s, i) => ({
      name: s.name,
      color: s.color ?? '#6366f1',
      order: i,
    }));
    return this.prisma.pipeline.create({
      data: {
        clientId: clientOf(p),
        name: dto.name,
        stages: { create: stages },
      },
      include: { stages: { orderBy: { order: 'asc' } } },
    });
  }

  async addStage(
    pipelineId: string,
    dto: { name: string; color?: string },
    p: Principal,
  ) {
    await this.requirePipeline(pipelineId, p);
    const max = await this.prisma.stage.aggregate({
      where: { pipelineId },
      _max: { order: true },
    });
    return this.prisma.stage.create({
      data: {
        pipelineId,
        name: dto.name,
        color: dto.color ?? '#6366f1',
        order: (max._max.order ?? -1) + 1,
      },
    });
  }

  async reorderStages(pipelineId: string, stageIds: string[], p: Principal) {
    await this.requirePipeline(pipelineId, p);
    await this.prisma.$transaction(
      stageIds.map((id, idx) =>
        this.prisma.stage.update({ where: { id }, data: { order: idx } }),
      ),
    );
    return { ok: true };
  }

  async remove(pipelineId: string, p: Principal) {
    await this.requirePipeline(pipelineId, p);
    await this.prisma.pipeline.delete({ where: { id: pipelineId } });
    return { ok: true };
  }

  private async requirePipeline(id: string, p: Principal) {
    const pipe = await this.prisma.pipeline.findUnique({ where: { id } });
    if (!pipe || pipe.clientId !== clientOf(p)) throw new NotFoundException();
    return pipe;
  }
}

export function clientOf(p: Principal): string {
  if (p.type === 'CLIENT') return p.id;
  if (p.type === 'TEAM_MEMBER') return p.clientId;
  throw new ForbiddenException();
}
