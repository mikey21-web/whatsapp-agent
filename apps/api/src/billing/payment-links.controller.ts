import { Body, Controller, Post } from '@nestjs/common';
import { IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { CurrentPrincipal, Roles } from '../common/decorators';
import { PaymentLinksService } from './payment-links.service';
import type { Principal } from '../auth/principal';

class CreatePaymentLinkDto {
  @IsString() conversationId!: string;
  @IsNumber() @Min(1) amountInr!: number;
  @IsString() @MinLength(1) @MaxLength(200) description!: string;
  @IsOptional() @IsString() @MaxLength(64) referenceId?: string;
}

@Controller('payment-links')
@Roles('CLIENT', 'TEAM_MEMBER')
export class PaymentLinksController {
  constructor(private readonly svc: PaymentLinksService) {}

  @Post()
  create(@Body() dto: CreatePaymentLinkDto, @CurrentPrincipal() p: Principal) {
    return this.svc.createAndSend(dto, p);
  }
}
