import { Global, Module } from '@nestjs/common';
import { AnthropicClient } from './anthropic.client';
import { EmbeddingsClient } from './embeddings.client';
import { SarvamClient } from './sarvam.client';
import { RagService } from './rag.service';
import { AiAgentService } from './ai-agent.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import { AiAgentController, KnowledgeBaseController } from './ai.controller';

@Global()
@Module({
  controllers: [AiAgentController, KnowledgeBaseController],
  providers: [
    AnthropicClient,
    EmbeddingsClient,
    SarvamClient,
    RagService,
    AiAgentService,
    KnowledgeBaseService,
  ],
  exports: [
    AnthropicClient,
    EmbeddingsClient,
    SarvamClient,
    RagService,
    AiAgentService,
    KnowledgeBaseService,
  ],
})
export class AiModule {}
