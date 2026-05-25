import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { CurrentPrincipal, Roles } from '../common/decorators';
import { MessageService } from './message.service';
import type { Principal } from '../auth/principal';

class SendMessageDto {
  @IsString() conversationId!: string;
  @IsString() @MinLength(1) content!: string;
}

@Controller('messages')
@Roles('CLIENT', 'TEAM_MEMBER')
export class MessageController {
  constructor(private readonly svc: MessageService) {}

  @Get() list(
    @CurrentPrincipal() p: Principal,
    @Query('conversationId') conversationId: string,
    @Query('take') take?: string,
    @Query('before') before?: string,
  ) {
    return this.svc.list(conversationId, p, {
      take: take ? Number(take) : undefined,
      before,
    });
  }

  @Post() send(@Body() dto: SendMessageDto, @CurrentPrincipal() p: Principal) {
    return this.svc.send(dto, p);
  }
}
