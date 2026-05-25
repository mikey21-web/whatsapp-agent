import { Injectable } from '@nestjs/common';
import type { WhatsappProvider } from '@diyaa/db';
import { EvolutionProvider } from './evolution.provider';
import { MetaCloudProvider } from './meta-cloud.provider';
import type { WhatsappProviderImpl } from './provider.types';

@Injectable()
export class ProviderRegistry {
  constructor(
    private readonly evolution: EvolutionProvider,
    private readonly metaCloud: MetaCloudProvider,
  ) {}

  for(provider: WhatsappProvider): WhatsappProviderImpl {
    return provider === 'META_CLOUD' ? this.metaCloud : this.evolution;
  }
}
