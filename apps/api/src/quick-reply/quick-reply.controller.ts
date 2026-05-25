import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CurrentPrincipal, Roles } from '../common/decorators';
import { QuickReplyService } from './quick-reply.service';
import type { Principal } from '../auth/principal';

class CreateDto {
  @IsString() @MinLength(1) @MaxLength(40) shortcut!: string;
  @IsString() @MinLength(1) body!: string;
}

class UpdateDto {
  @IsOptional() @IsString() @MaxLength(40) shortcut?: string;
  @IsOptional() @IsString() body?: string;
}

@Controller('quick-replies')
@Roles('CLIENT', 'TEAM_MEMBER')
export class QuickReplyController {
  constructor(private readonly svc: QuickReplyService) {}

  @Get() list(@CurrentPrincipal() p: Principal) { return this.svc.list(p); }
  @Post() create(@Body() dto: CreateDto, @CurrentPrincipal() p: Principal) { return this.svc.create(dto, p); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateDto, @CurrentPrincipal() p: Principal) { return this.svc.update(id, dto, p); }
  @Delete(':id') remove(@Param('id') id: string, @CurrentPrincipal() p: Principal) { return this.svc.remove(id, p); }
}
