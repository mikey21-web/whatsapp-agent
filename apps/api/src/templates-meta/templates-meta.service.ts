import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { decryptJson } from '../integrations/crypto.util';
import { env } from '../config/env';
import type { Principal } from '../auth/principal';

const GRAPH_API = 'https://graph.facebook.com/v22.0';

interface CreateTemplateDto {
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  components: unknown[];
}

interface MetaToken { access_token: string }

@Injectable()
export class TemplatesMetaService {
  private readonly logger = new Logger('Templates:Meta');

  constructor(private readonly prisma: PrismaService) {}

  async list(accountId: string, p: Principal) {
    const acct = await this.requireAccount(accountId, p);
    return this.prisma.whatsappTemplate.findMany({
      where: { whatsappAccountId: acct.id },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Submit a template to Meta for approval and persist a local row.
   * Returns the row including Meta's status (typically PENDING).
   */
  async submit(accountId: string, dto: CreateTemplateDto, p: Principal) {
    const acct = await this.requireAccount(accountId, p);
    if (acct.provider !== 'META_CLOUD') {
      throw new ForbiddenException('Templates only apply to Meta Cloud accounts');
    }
    if (!acct.wabaId) throw new ForbiddenException('wabaId missing on account');

    const token = this.tokenFor(acct);
    let metaTemplateId: string | null = null;
    let status = 'PENDING';
    let rejectionReason: string | null = null;
    try {
      const { data } = await axios.post<{ id: string; status?: string; category?: string }>(
        `${GRAPH_API}/${encodeURIComponent(acct.wabaId)}/message_templates`,
        {
          name: dto.name,
          language: dto.language,
          category: dto.category,
          components: dto.components,
        },
        {
          headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          timeout: 15_000,
        },
      );
      metaTemplateId = data.id;
      status = data.status ?? 'PENDING';
    } catch (e: any) {
      rejectionReason = e?.response?.data?.error?.message ?? (e as Error).message;
      status = 'REJECTED';
    }

    return this.prisma.whatsappTemplate.upsert({
      where: {
        whatsappAccountId_name_language: {
          whatsappAccountId: acct.id,
          name: dto.name,
          language: dto.language,
        },
      },
      create: {
        whatsappAccountId: acct.id,
        name: dto.name,
        language: dto.language,
        category: dto.category,
        components: dto.components as object,
        metaTemplateId,
        status,
        rejectionReason,
      },
      update: {
        category: dto.category,
        components: dto.components as object,
        metaTemplateId,
        status,
        rejectionReason,
      },
    });
  }

  /**
   * Pull the WABA's templates from Meta and reconcile local state.
   * Use this when admins approve/reject templates outside our UI.
   */
  async syncFromMeta(accountId: string, p: Principal) {
    const acct = await this.requireAccount(accountId, p);
    if (acct.provider !== 'META_CLOUD' || !acct.wabaId) {
      throw new ForbiddenException('Sync only applies to Meta Cloud accounts');
    }
    const token = this.tokenFor(acct);
    const { data } = await axios.get<{
      data: { id: string; name: string; language: string; status: string; category: string; components: unknown[] }[];
    }>(
      `${GRAPH_API}/${encodeURIComponent(acct.wabaId)}/message_templates`,
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 30_000,
      },
    );
    let upserted = 0;
    for (const t of data.data ?? []) {
      await this.prisma.whatsappTemplate.upsert({
        where: {
          whatsappAccountId_name_language: {
            whatsappAccountId: acct.id,
            name: t.name,
            language: t.language,
          },
        },
        create: {
          whatsappAccountId: acct.id,
          name: t.name,
          language: t.language,
          category: t.category,
          components: t.components as object,
          metaTemplateId: t.id,
          status: t.status,
        },
        update: {
          category: t.category,
          components: t.components as object,
          metaTemplateId: t.id,
          status: t.status,
        },
      });
      upserted++;
    }
    return { synced: upserted };
  }

  // ── helpers ──

  private async requireAccount(id: string, p: Principal) {
    const clientId = clientOf(p);
    const a = await this.prisma.whatsappAccount.findUnique({ where: { id } });
    if (!a || a.clientId !== clientId) throw new NotFoundException();
    return a;
  }

  private tokenFor(account: { accessTokenEnc: string | null }): string {
    if (env.META_SYSTEM_USER_TOKEN) return env.META_SYSTEM_USER_TOKEN;
    if (!account.accessTokenEnc) throw new ForbiddenException('Meta access token missing');
    const decoded = decryptJson<MetaToken>(account.accessTokenEnc);
    return decoded.access_token;
  }
}

function clientOf(p: Principal): string {
  if (p.type === 'CLIENT') return p.id;
  if (p.type === 'TEAM_MEMBER') return p.clientId;
  throw new ForbiddenException();
}
