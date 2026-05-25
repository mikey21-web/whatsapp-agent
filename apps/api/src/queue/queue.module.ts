import { Global, Module } from '@nestjs/common';
import { Queue, JobsOptions } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env';
import { Processors } from './processors.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AiModule } from '../ai/ai.module';

export const Q_INBOUND = 'inbound-messages';
export const Q_OUTBOUND = 'outbound-messages';
export const Q_CAMPAIGN = 'campaign-broadcasts';

const defaultJobOpts: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};

@Global()
@Module({
  imports: [WhatsappModule, RealtimeModule, AiModule],
  providers: [
    {
      provide: 'REDIS_CONNECTION',
      useFactory: () => new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null }),
    },
    {
      provide: Q_INBOUND,
      inject: ['REDIS_CONNECTION'],
      useFactory: (redis: IORedis) =>
        new Queue(Q_INBOUND, { connection: redis, defaultJobOptions: defaultJobOpts }),
    },
    {
      provide: Q_OUTBOUND,
      inject: ['REDIS_CONNECTION'],
      useFactory: (redis: IORedis) =>
        new Queue(Q_OUTBOUND, { connection: redis, defaultJobOptions: defaultJobOpts }),
    },
    {
      provide: Q_CAMPAIGN,
      inject: ['REDIS_CONNECTION'],
      useFactory: (redis: IORedis) =>
        new Queue(Q_CAMPAIGN, { connection: redis, defaultJobOptions: defaultJobOpts }),
    },
    Processors,
  ],
  exports: ['REDIS_CONNECTION', Q_INBOUND, Q_OUTBOUND, Q_CAMPAIGN],
})
export class QueueModule {}
