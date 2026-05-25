import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../common/decorators';
import { AgencyService } from './agency.service';
import { CreateAgencyDto, UpdateAgencyDto } from './agency.dto';

@Controller('agencies')
@Roles('SUPER_ADMIN')
export class AgencyController {
  constructor(private readonly svc: AgencyService) {}

  @Get() list() { return this.svc.list(); }

  @Post() create(@Body() dto: CreateAgencyDto) { return this.svc.create(dto); }

  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateAgencyDto) {
    return this.svc.update(id, dto);
  }

  @Post(':id/suspend') suspend(@Param('id') id: string) { return this.svc.setActive(id, false); }
  @Post(':id/activate') activate(@Param('id') id: string) { return this.svc.setActive(id, true); }

  @Delete(':id') remove(@Param('id') id: string) { return this.svc.remove(id); }
}
