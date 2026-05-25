import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { WhatsappAccount, WhatsappProvider } from '@diyaa/db';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderRegistry } from './provider.registry';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { GuardrailService } from './guardrail.service';
import { encryptJson } from '../integrations/crypto.util';
import { env } from '../config/env';
import type { Principal } from '../auth/principal';

interface CreateAccountDto {
  provider?: WhatsappProvider;
  instanceName: string;
  phoneNumber: string;
  displayName?: string;
  // Meta Cloud specifics:
  wabaId?: string;
  phoneNumberId?: string;
  accessToken?: string;
}

@Injectable()
export class WhatsappService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProviderRegistry,
    private readonly limits: PlanLimitsService,
    private readonly guardrails: GuardrailService,
  ) {}

  list(principal: Principal) {
    return this.prisma.whatsappAccount.findMany({
      where: { clientId: this.requireClient(principal) },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        provider: true,
        instanceName: true,
        phoneNumber: true,
        displayName: true,
        isConnected: true,
        wabaId: true,
        phoneNumberId: true,
        qualityRating: true,
        messagingTier: true,
        msgsPerMinute: true,
        msgsPerDay: true,
        warmupMode: true,
        outboundPaused: true,
        webhookUrl: true,
        createdAt: true,
      },
    });
  }

  async create(dto: CreateAccountDto, principal: Principal) {
    const clientId = this.requireClient(principal);
    await this.limits.assertCanAddNumber(clientId);
    const provider = dto.provider ?? 'EVOLUTION';

    // Provider-specific validation
    if (provider === 'META_CLOUD') {
      if (!dto.phoneNumberId || !dto.wabaId) {
        throw new ConflictException('Meta Cloud account needs phoneNumberId and wabaId');
      }
      const dup = await this.prisma.whatsappAccount.findUnique({
        where: { phoneNumberId: dto.phoneNumberId },
      });
      if (dup) throw new ConflictException('phoneNumberId already in use');
    }
    if (await this.prisma.whatsappAccount.findUnique({ where: { instanceName: dto.instanceName } })) {
      throw new ConflictException('Instance name in use');
    }

    const webhookUrl = `${env.WEBHOOK_PUBLIC_URL}/webhooks/whatsapp/${provider.toLowerCase()}/${encodeURIComponent(provider === 'META_CLOUD' ? (dto.phoneNumberId ?? dto.instanceName) : dto.instanceName)}`;

    const account = await this.prisma.whatsappAccount.create({
      data: {
        clientId,
        provider,
        instanceName: dto.instanceName,
        phoneNumber: dto.phoneNumber,
        displayName: dto.displayName,
        webhookUrl,
        wabaId: dto.wabaId,
        phoneNumberId: dto.phoneNumberId,
        accessTokenEnc: dto.accessToken ? encryptJson({ access_token: dto.accessToken }) : null,
        // Conservative defaults: Cloud API gets a higher rate limit since Meta sanctions it.
        msgsPerMinute: provider === 'META_CLOUD' ? 60 : 20,
      },
    });

    if (provider === 'EVOLUTION') {
      await this.registry.for('EVOLUTION').provision?.({
        ...account,
      });
    }

    return account;
  }

  async qr(id: string, principal: Principal) {
    const acct = await this.requireAccount(id, principal);
    return this.registry.for(acct.provider).getQR(acct);
  }

  async status(id: string, principal: Principal) {
    const acct = await this.requireAccount(id, principal);
    return this.registry.for(acct.provider).getStatus(acct);
  }

  async setOutboundPaused(id: string, paused: boolean, principal: Principal) {
    const acct = await this.requireAccount(id, principal);
    return this.prisma.whatsappAccount.update({
      where: { id: acct.id },
      data: { outboundPaused: paused },
    });
  }

  async setLimits(
    id: string,
    dto: { msgsPerMinute?: number; msgsPerDay?: number; warmupMode?: boolean },
    principal: Principal,
  ) {
    const acct = await this.requireAccount(id, principal);
    return this.prisma.whatsappAccount.update({
      where: { id: acct.id },
      data: {
        ...(dto.msgsPerMinute !== undefined ? { msgsPerMinute: Math.max(1, Math.min(600, dto.msgsPerMinute)) } : {}),
        ...(dto.msgsPerDay !== undefined ? { msgsPerDay: Math.max(0, dto.msgsPerDay) } : {}),
        ...(dto.warmupMode !== undefined ? { warmupMode: dto.warmupMode } : {}),
      },
    });
  }

  async remove(id: string, principal: Principal) {
    const acct = await this.requireAccount(id, principal);
    await this.registry.for(acct.provider).teardown?.(acct);
    await this.prisma.whatsappAccount.delete({ where: { id: acct.id } });
    return { ok: true };
  }

  /**
   * Outbound entry point used by workers. Applies guardrails THEN dispatches via provider.
   * Returns the WhatsApp message id on success or throws ForbiddenException with reason.
   */
  async sendOutbound(
    account: WhatsappAccount,
    args: { to: string; text: string; isTemplate?: boolean; templateName?: string; templateLang?: string; variables?: string[] },
  ): Promise<{ waMessageId: string | null; isCold: boolean }> {
    const pre = await this.guardrails.preflight({
      account,
      toPhone: args.to,
      isTemplate: !!args.isTemplate,
    });
    if (!pre.allow) throw new ForbiddenException(pre.reason ?? 'blocked by guardrails');

    const provider = this.registry.for(account.provider);
    try {
      let result;
      if (args.isTemplate && provider.sendTemplate) {
        result = await provider.sendTemplate(account, {
          to: args.to,
          templateName: args.templateName ?? '',
          language: args.templateLang ?? 'en',
          variables: args.variables,
        });
      } else {
        result = await provider.sendText(account, { to: args.to, text: args.text });
      }
      return { waMessageId: result.waMessageId, isCold: pre.isCold };
    } catch (e) {
      // Refund the rate-limit slot on send failure so retries aren't double-counted.
      await this.guardrails.refundRate(account.id).catch(() => undefined);
      throw e;
    }
  }

  // ── helpers ──

  private requireClient(principal: Principal): string {
    if (principal.type === 'CLIENT') return principal.id;
    if (principal.type === 'TEAM_MEMBER') return principal.clientId;
    throw new ForbiddenException();
  }

  private async requireAccount(id: string, principal: Principal): Promise<WhatsappAccount> {
    const clientId = this.requireClient(principal);
    const a = await this.prisma.whatsappAccount.findUnique({ where: { id } });
    if (!a || a.clientId !== clientId) throw new NotFoundException();
    return a;
  }
}
