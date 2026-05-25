import { Module } from '@nestjs/common';
import { TemplatesMetaController } from './templates-meta.controller';
import { TemplatesMetaService } from './templates-meta.service';

@Module({
  controllers: [TemplatesMetaController],
  providers: [TemplatesMetaService],
  exports: [TemplatesMetaService],
})
export class TemplatesMetaModule {}
