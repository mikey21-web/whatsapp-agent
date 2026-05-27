import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { CampaignType } from '@diyaa/db';
import { PrismaService } from '../prisma/prisma.service';
import { Q_CAMPAIGN } from '../queue/queue.module';
import type { Principal } from '../auth/principal';

@Injectable()
export class CampaignService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(Q_CAMPAIGN) private readonly queue: Queue,
  ) {}

  list(p: Principal) {
    return this.prisma.campaign.findMany({
      where: { clientId: clientOf(p) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    dto: {
      name: string;
      type: CampaignType;
      template: string;
      mediaUrl?: string;
      tagFilter?: string[];
      scheduledAt?: string;
    },
    p: Principal,
  ) {
    const clientId = clientOf(p);
    return this.prisma.campaign.create({
      data: {
        clientId,
        name: dto.name,
        type: dto.type,
        template: dto.template,
        mediaUrl: dto.mediaUrl,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        status: dto.scheduledAt ? 'SCHEDULED' : 'DRAFT',
      },
    });
  }

  async start(id: string, p: Principal, opts: { tagFilter?: string[] }) {
    const clientId = clientOf(p);
    const c = await this.prisma.campaign.findUnique({ where: { id } });
    if (!c || c.clientId !== clientId) throw new NotFoundException();

    const recipients = await this.prisma.contact.findMany({
      where: {
        clientId,
        optedOut: false,
        isBlocked: false,
        ...(opts.tagFilter && opts.tagFilter.length
          ? { tags: { hasSome: opts.tagFilter } }
          : {}),
      },
      select: { id: true },
    });

    await this.prisma.campaign.update({
      where: { id },
      data: { status: 'SENDING', recipients: recipients.length, sentAt: new Date() },
    });

    // Throttle so we don't burst — 1 msg every 200ms per campaign.
    let i = 0;
    for (const r of recipients) {
      await this.queue.add(
        'send',
        { campaignId: id, contactId: r.id },
        { delay: i * 200, jobId: `camp-${id}-${r.id}` },
      );
      i++;
    }
    return { queued: recipients.length };
  }

  async pause(id: string, p: Principal) {
    const c = await this.prisma.campaign.findUnique({ where: { id } });
    if (!c || c.clientId !== clientOf(p)) throw new NotFoundException();
    return this.prisma.campaign.update({ where: { id }, data: { status: 'PAUSED' } });
  }
}

function clientOf(p: Principal): string {
  if (p.type === 'CLIENT') return p.id;
  if (p.type === 'TEAM_MEMBER') return p.clientId;
  throw new ForbiddenException();
}
