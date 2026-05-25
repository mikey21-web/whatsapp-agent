import { Global, Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { EvolutionClient } from './evolution.client';
import { EvolutionProvider } from './evolution.provider';
import { MetaCloudProvider } from './meta-cloud.provider';
import { ProviderRegistry } from './provider.registry';
import { GuardrailService } from './guardrail.service';
import { EmbeddedSignupController } from './embedded-signup.controller';
import { EmbeddedSignupService } from './embedded-signup.service';

@Global()
@Module({
  controllers: [WhatsappController, EmbeddedSignupController],
  providers: [
    WhatsappService,
    EvolutionClient,
    EvolutionProvider,
    MetaCloudProvider,
    ProviderRegistry,
    GuardrailService,
    EmbeddedSignupService,
  ],
  exports: [
    WhatsappService,
    EvolutionClient,
    ProviderRegistry,
    GuardrailService,
    EmbeddedSignupService,
  ],
})
export class WhatsappModule {}
