import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentPrincipal, Roles } from '../common/decorators';
import { ClientService } from './client.service';
import { CreateClientDto, UpdateClientDto } from './client.dto';
import type { Principal } from '../auth/principal';

@Controller('clients')
@Roles('SUPER_ADMIN', 'AGENCY')
export class ClientController {
  constructor(private readonly svc: ClientService) {}

  @Get() list(@CurrentPrincipal() p: Principal) { return this.svc.list(p); }
  @Get(':id') get(@Param('id') id: string, @CurrentPrincipal() p: Principal) { return this.svc.get(id, p); }
  @Post() create(@Body() dto: CreateClientDto, @CurrentPrincipal() p: Principal) { return this.svc.create(dto, p); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateClientDto, @CurrentPrincipal() p: Principal) { return this.svc.update(id, dto, p); }
  @Post(':id/suspend') suspend(@Param('id') id: string, @CurrentPrincipal() p: Principal) { return this.svc.setActive(id, false, p); }
  @Post(':id/activate') activate(@Param('id') id: string, @CurrentPrincipal() p: Principal) { return this.svc.setActive(id, true, p); }
  @Delete(':id') remove(@Param('id') id: string, @CurrentPrincipal() p: Principal) { return this.svc.remove(id, p); }
}
