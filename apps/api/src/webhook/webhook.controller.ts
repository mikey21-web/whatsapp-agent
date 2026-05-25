import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { WhatsappProvider } from '@diyaa/db';
import { Public } from '../common/decorators';
import { WebhookService } from './webhook.service';
import { ProviderRegistry } from '../whatsapp/provider.registry';

const PROVIDERS = ['evolution', 'meta_cloud'] as const;

@Controller('webhooks/whatsapp')
@Public()
export class WebhookController {
  constructor(
    private readonly svc: WebhookService,
    private readonly registry: ProviderRegistry,
  ) {}

  /**
   * Meta Cloud API verification handshake.
   * Meta calls GET /webhooks/whatsapp/meta_cloud/:identifier?hub.mode=subscribe&...
   */
  @Get(':provider/:identifier')
  async verify(
    @Param('provider') provider: string,
    @Query() query: Record<string, string | undefined>,
    @Res() res: Response,
  ) {
    const p = parseProvider(provider);
    const impl = this.registry.for(p);
    if (impl.handleVerificationGet) {
      const challenge = impl.handleVerificationGet(query);
      if (challenge) return res.status(200).send(challenge);
    }
    return res.status(403).send('forbidden');
  }

  @Post(':provider/:identifier')
  @HttpCode(200)
  async handle(
    @Param('provider') provider: string,
    @Param('identifier') identifier: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() req: Request & { rawBody?: Buffer },
    @Body() body: unknown,
  ) {
    const p = parseProvider(provider);
    const impl = this.registry.for(p);
    const rawBody = req.rawBody?.toString('utf8') ?? JSON.stringify(body ?? {});
    if (!impl.verifyWebhook({ rawBody, headers })) {
      throw new ForbiddenException('Invalid webhook credential');
    }
    const events = impl.parseWebhook(body);
    await this.svc.handleParsedEvents(p, identifier, events);
    return { ok: true };
  }
}

function parseProvider(s: string): WhatsappProvider {
  const lower = s.toLowerCase();
  if (!PROVIDERS.includes(lower as any)) throw new BadRequestException('Unknown provider');
  return lower === 'meta_cloud' ? 'META_CLOUD' : 'EVOLUTION';
}
