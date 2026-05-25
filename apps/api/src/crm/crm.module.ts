import { Module } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { DealService } from './deal.service';
import { DealController, PipelineController, TimelineController } from './crm.controller';

@Module({
  controllers: [PipelineController, DealController, TimelineController],
  providers: [PipelineService, DealService],
  exports: [PipelineService, DealService],
})
export class CrmModule {}
