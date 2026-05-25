import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsArray, IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { CurrentPrincipal, Roles } from '../common/decorators';
import { AiAgentService } from './ai-agent.service';
import { KnowledgeBaseService } from './knowledge-base.service';
import type { Principal } from '../auth/principal';

class CreateAgentDto {
  @IsString() @MinLength(1) name!: string;
  @IsString() persona!: string;
  @IsString() systemPrompt!: string;
  @IsOptional() @IsArray() language?: string[];
  @IsOptional() @IsArray() handoffKeywords?: string[];
  @IsOptional() @IsString() knowledgeBaseId?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class CreateKbDto {
  @IsString() @MinLength(1) name!: string;
}

class AddDocDto {
  @IsString() @MinLength(1) title!: string;
  @IsString() @MinLength(1) content!: string;
}

@Controller('ai-agents')
@Roles('CLIENT', 'TEAM_MEMBER')
export class AiAgentController {
  constructor(private readonly svc: AiAgentService) {}

  @Get() list(@CurrentPrincipal() p: Principal) { return this.svc.list(p); }
  @Get(':id') get(@Param('id') id: string, @CurrentPrincipal() p: Principal) { return this.svc.get(id, p); }
  @Post() create(@Body() dto: CreateAgentDto, @CurrentPrincipal() p: Principal) { return this.svc.create(dto, p); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: Partial<CreateAgentDto>, @CurrentPrincipal() p: Principal) { return this.svc.update(id, dto, p); }
  @Delete(':id') remove(@Param('id') id: string, @CurrentPrincipal() p: Principal) { return this.svc.remove(id, p); }
}

@Controller('knowledge-bases')
@Roles('CLIENT', 'TEAM_MEMBER')
export class KnowledgeBaseController {
  constructor(private readonly svc: KnowledgeBaseService) {}

  @Get() list(@CurrentPrincipal() p: Principal) { return this.svc.list(p); }
  @Post() create(@Body() dto: CreateKbDto, @CurrentPrincipal() p: Principal) { return this.svc.create(dto, p); }
  @Delete(':id') remove(@Param('id') id: string, @CurrentPrincipal() p: Principal) { return this.svc.remove(id, p); }

  @Get(':id/documents') docs(@Param('id') id: string, @CurrentPrincipal() p: Principal) {
    return this.svc.listDocuments(id, p);
  }

  @Post(':id/documents') addDoc(
    @Param('id') id: string,
    @Body() dto: AddDocDto,
    @CurrentPrincipal() p: Principal,
  ) {
    return this.svc.addDocument(id, dto, p);
  }

  @Delete(':id/documents/:docId') removeDoc(
    @Param('id') id: string,
    @Param('docId') docId: string,
    @CurrentPrincipal() p: Principal,
  ) {
    return this.svc.removeDocument(id, docId, p);
  }

  @Get(':id/test') test(
    @Param('id') id: string,
    @Query('q') q: string,
    @CurrentPrincipal() p: Principal,
  ) {
    return this.svc.test(id, q, p);
  }
}
