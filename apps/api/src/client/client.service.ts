import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import type { CreateClientDto, UpdateClientDto } from './client.dto';
import type { Principal } from '../auth/principal';

@Injectable()
export class ClientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly limits: PlanLimitsService,
  ) {}

  list(principal: Principal) {
    const where = this.scope(principal);
    return this.prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: clientSelect,
    });
  }

  async get(id: string, principal: Principal) {
    const c = await this.prisma.client.findUnique({ where: { id }, select: clientSelect });
    if (!c) throw new NotFoundException('Client not found');
    if (!this.canAccess(principal, c.agencyId)) throw new ForbiddenException();
    return c;
  }

  async create(dto: CreateClientDto, principal: Principal) {
    const agencyId = this.requireAgencyContext(principal);
    await this.limits.assertCanAddClient(agencyId);
    const existing = await this.prisma.client.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');
    const password = await this.auth.hashPassword(dto.password);
    return this.prisma.client.create({
      data: {
        agencyId,
        email: dto.email,
        password,
        name: dto.name,
        businessName: dto.businessName,
        phone: dto.phone,
        vertical: dto.vertical ?? 'GENERAL',
      },
      select: clientSelect,
    });
  }

  async update(id: string, dto: UpdateClientDto, principal: Principal) {
    const c = await this.requireClient(id, principal);
    return this.prisma.client.update({ where: { id: c.id }, data: dto, select: clientSelect });
  }

  async setActive(id: string, isActive: boolean, principal: Principal) {
    const c = await this.requireClient(id, principal);
    return this.prisma.client.update({
      where: { id: c.id },
      data: { isActive },
      select: clientSelect,
    });
  }

  async remove(id: string, principal: Principal) {
    const c = await this.requireClient(id, principal);
    await this.prisma.client.delete({ where: { id: c.id } });
    return { ok: true };
  }

  private async requireClient(id: string, principal: Principal) {
    const c = await this.prisma.client.findUnique({ where: { id }, select: clientSelect });
    if (!c) throw new NotFoundException('Client not found');
    if (!this.canAccess(principal, c.agencyId)) throw new ForbiddenException();
    return c;
  }

  private canAccess(principal: Principal, agencyId: string): boolean {
    if (principal.type === 'SUPER_ADMIN') return true;
    if (principal.type === 'AGENCY') return principal.id === agencyId;
    return false;
  }

  private requireAgencyContext(principal: Principal): string {
    if (principal.type === 'AGENCY') return principal.id;
    throw new ForbiddenException('Agency context required');
  }

  private scope(principal: Principal) {
    if (principal.type === 'SUPER_ADMIN') return {};
    if (principal.type === 'AGENCY') return { agencyId: principal.id };
    throw new ForbiddenException();
  }
}

const clientSelect = {
  id: true,
  agencyId: true,
  email: true,
  name: true,
  businessName: true,
  phone: true,
  vertical: true,
  isActive: true,
  emailVerifiedAt: true,
  mfaEnabled: true,
  createdAt: true,
} as const;
