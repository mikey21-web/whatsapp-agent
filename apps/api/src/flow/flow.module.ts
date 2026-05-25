import { Module } from '@nestjs/common';
import { FlowController } from './flow.controller';
import { FlowService } from './flow.service';
import { FlowExecutor } from './flow.executor';

@Module({
  controllers: [FlowController],
  providers: [FlowService, FlowExecutor],
  exports: [FlowService, FlowExecutor],
})
export class FlowModule {}
