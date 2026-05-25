import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Principal } from '../auth/principal';
import { clientOf } from './pipeline.service';
import type { DealStatus } from '@diyaa/db';

@Injectable()
export class DealService {
  constructor(private readonly prisma: PrismaService) {}

  list(p: Principal, query: { pipelineId?: string }) {
    return this.prisma.deal.findMany({
      where: {
        clientId: clientOf(p),
        ...(query.pipelineId ? { pipelineId: query.pipelineId } : {}),
      },
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        stage: { select: { id: true, name: true, color: true, order: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async board(pipelineId: string, p: Principal) {
    const clientId = clientOf(p);
    const pipe = await this.prisma.pipeline.findUnique({
      where: { id: pipelineId },
      include: {
        stages: {
          orderBy: { order: 'asc' },
          include: {
            deals: {
              where: { clientId },
              orderBy: { createdAt: 'desc' },
              include: { contact: { select: { id: true, name: true, phone: true } } },
            },
          },
        },
      },
    });
    if (!pipe || pipe.clientId !== clientId) throw new NotFoundException();
    return pipe;
  }

  async create(
    dto: {
      title: string;
      contactId: string;
      pipelineId: string;
      stageId?: string;
      value?: number;
      currency?: string;
    },
    p: Principal,
  ) {
    const clientId = clientOf(p);
    const [contact, pipeline] = await Promise.all([
      this.prisma.contact.findUnique({ where: { id: dto.contactId } }),
      this.prisma.pipeline.findUnique({
        where: { id: dto.pipelineId },
        include: { stages: { orderBy: { order: 'asc' }, take: 1 } },
      }),
    ]);
    if (!contact || contact.clientId !== clientId) throw new NotFoundException('Contact');
    if (!pipeline || pipeline.clientId !== clientId) throw new NotFoundException('Pipeline');
    const stageId = dto.stageId ?? pipeline.stages[0]?.id;
    if (!stageId) throw new NotFoundException('No stages on pipeline');
    if (dto.stageId) {
      const okay = pipeline.stages.find((s) => s.id === stageId);
      if (!okay) {
        const found = await this.prisma.stage.findUnique({ where: { id: stageId } });
        if (!found || found.pipelineId !== pipeline.id) throw new NotFoundException('Stage');
      }
    }
    const deal = await this.prisma.deal.create({
      data: {
        clientId,
        contactId: contact.id,
        pipelineId: pipeline.id,
        stageId,
        title: dto.title,
        value: dto.value,
        currency: dto.currency ?? 'INR',
      },
    });
    await this.prisma.activity.create({
      data: { contactId: contact.id, dealId: deal.id, type: 'DEAL_CREATED' },
    });
    return deal;
  }

  async moveStage(dealId: string, stageId: string, p: Principal) {
    const clientId = clientOf(p);
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal || deal.clientId !== clientId) throw new NotFoundException();
    const stage = await this.prisma.stage.findUnique({ where: { id: stageId } });
    if (!stage || stage.pipelineId !== deal.pipelineId) throw new NotFoundException('Stage');
    const updated = await this.prisma.deal.update({
      where: { id: dealId },
      data: { stageId },
    });
    await this.prisma.activity.create({
      data: {
        dealId,
        contactId: deal.contactId,
        type: 'DEAL_STAGE_CHANGED',
        metadata: { fromStageId: deal.stageId, toStageId: stageId },
      },
    });
    return updated;
  }

  async updateStatus(dealId: string, status: DealStatus, p: Principal) {
    const clientId = clientOf(p);
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal || deal.clientId !== clientId) throw new NotFoundException();
    const updated = await this.prisma.deal.update({
      where: { id: dealId },
      data: {
        status,
        closedAt: status === 'OPEN' ? null : new Date(),
      },
    });
    if (status === 'WON' || status === 'LOST') {
      await this.prisma.activity.create({
        data: {
          dealId,
          contactId: deal.contactId,
          type: status === 'WON' ? 'DEAL_WON' : 'DEAL_LOST',
        },
      });
    }
    return updated;
  }

  async addNote(dealId: string, content: string, p: Principal) {
    const clientId = clientOf(p);
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal || deal.clientId !== clientId) throw new NotFoundException();
    const note = await this.prisma.note.create({ data: { dealId, content } });
    await this.prisma.activity.create({
      data: { dealId, contactId: deal.contactId, type: 'NOTE_ADDED' },
    });
    return note;
  }

  async timeline(contactId: string, p: Principal) {
    const clientId = clientOf(p);
    const contact = await this.prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact || contact.clientId !== clientId) throw new NotFoundException();
    return this.prisma.activity.findMany({
      where: { contactId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
