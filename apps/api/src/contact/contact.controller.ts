import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { CurrentPrincipal, Roles } from '../common/decorators';
import { ContactService } from './contact.service';
import type { Principal } from '../auth/principal';

class ImportDto {
  @IsString() @MinLength(1) csv!: string;
}

@Controller('contacts')
@Roles('CLIENT', 'TEAM_MEMBER')
export class ContactController {
  constructor(private readonly svc: ContactService) {}

  @Get() list(
    @CurrentPrincipal() p: Principal,
    @Query('search') search?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('tag') tag?: string,
  ) {
    return this.svc.list(p, {
      search,
      tag,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Get(':id') get(@Param('id') id: string, @CurrentPrincipal() p: Principal) {
    return this.svc.get(id, p);
  }

  @Post('import') importCsv(@Body() dto: ImportDto, @CurrentPrincipal() p: Principal) {
    if (dto.csv.length > 5 * 1024 * 1024) {
      throw new Error('CSV too large (max 5 MB)');
    }
    return this.svc.importCsv(p, dto.csv);
  }
}
