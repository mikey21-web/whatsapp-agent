import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { Prisma, Vertical } from '@diyaa/db';
import { PrismaService } from '../prisma/prisma.service';
import { RagService } from '../ai/rag.service';
import { VERTICAL_TEMPLATES } from './vertical-templates';
import type { Principal } from '../auth/principal';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger('Templates');

  constructor(
    private readonly prisma: PrismaService,
    private readonly rag: RagService,
  ) {}

  list() {
    return Object.values(VERTICAL_TEMPLATES).map((t) => ({
      vertical: t.vertical,
      label: t.label,
      agent: { name: t.agent.name, persona: t.agent.persona },
      pipelineStages: t.pipeline.stages.map((s) => s.name),
      flowCount: t.flows.length,
      kbSeeds: t.knowledge.length,
    }));
  }

  /**
   * Idempotent-ish bootstrap: seeds an AI agent, pipeline, optional flows and KB
   * for the calling client based on a chosen vertical. Names are prefixed so re-running
   * creates a new bundle rather than clashing.
   */
  async apply(vertical: Vertical, p: Principal): Promise<{
    agentId: string;
    pipelineId: string;
    knowledgeBaseId: string | null;
    flowIds: string[];
  }> {
    const clientId = clientOf(p);
    const tpl = VERTICAL_TEMPLATES[vertical];
    if (!tpl) throw new Error('Unknown vertical');

    let knowledgeBaseId: string | null = null;
    if (tpl.knowledge.length > 0) {
      const kb = await this.prisma.knowledgeBase.create({
        data: { clientId, name: `${tpl.label} starter KB` },
      });
      knowledgeBaseId = kb.id;
      for (const seed of tpl.knowledge) {
        await this.rag.ingest({
          knowledgeBaseId: kb.id,
          title: seed.title,
          content: seed.content,
        });
      }
    }

    const agent = await this.prisma.aIAgent.create({
      data: {
        clientId,
        name: tpl.agent.name,
        persona: tpl.agent.persona,
        systemPrompt: tpl.agent.systemPrompt,
        language: tpl.agent.language,
        handoffKeywords: tpl.agent.handoffKeywords,
        knowledgeBaseId,
        isActive: true,
      },
    });

    const pipeline = await this.prisma.pipeline.create({
      data: {
        clientId,
        name: tpl.pipeline.name,
        stages: {
          create: tpl.pipeline.stages.map((s, i) => ({
            name: s.name,
            color: s.color,
            order: i,
          })),
        },
      },
    });

    const flowIds: string[] = [];
    for (const f of tpl.flows) {
      const created = await this.prisma.flow.create({
        data: {
          clientId,
          name: f.name,
          trigger: f.trigger,
          nodes: f.doc.nodes as unknown as Prisma.InputJsonValue,
          edges: f.doc.edges as unknown as Prisma.InputJsonValue,
          isActive: true,
        },
      });
      flowIds.push(created.id);
    }

    // Mark client's vertical so the UI can adapt (e.g. custom fields).
    await this.prisma.client.update({
      where: { id: clientId },
      data: { vertical },
    });

    return {
      agentId: agent.id,
      pipelineId: pipeline.id,
      knowledgeBaseId,
      flowIds,
    };
  }
}

function clientOf(p: Principal): string {
  if (p.type === 'CLIENT') return p.id;
  if (p.type === 'TEAM_MEMBER' && p.role === 'ADMIN') return p.clientId;
  throw new ForbiddenException('Only client owner / admin can apply templates');
}
