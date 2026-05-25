import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import type { CreateTeamMemberDto, UpdateTeamMemberDto } from './team.dto';
import type { Principal } from '../auth/principal';

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  list(principal: Principal) {
    return this.prisma.teamMember.findMany({
      where: { clientId: this.requireClient(principal) },
      orderBy: { createdAt: 'desc' },
      select: select,
    });
  }

  async create(dto: CreateTeamMemberDto, principal: Principal) {
    const clientId = this.requireClient(principal);
    if (principal.type === 'TEAM_MEMBER' && principal.role !== 'ADMIN') {
      throw new ForbiddenException('Only admin team members can add others');
    }
    const existing = await this.prisma.teamMember.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');
    const password = await this.auth.hashPassword(dto.password);
    return this.prisma.teamMember.create({
      data: {
        clientId,
        email: dto.email,
        password,
        name: dto.name,
        role: dto.role ?? 'AGENT',
      },
      select: select,
    });
  }

  async update(id: string, dto: UpdateTeamMemberDto, principal: Principal) {
    const clientId = this.requireClient(principal);
    const m = await this.prisma.teamMember.findUnique({ where: { id }, select: { clientId: true } });
    if (!m || m.clientId !== clientId) throw new NotFoundException();
    return this.prisma.teamMember.update({ where: { id }, data: dto, select: select });
  }

  async setActive(id: string, isActive: boolean, principal: Principal) {
    const clientId = this.requireClient(principal);
    const m = await this.prisma.teamMember.findUnique({ where: { id }, select: { clientId: true } });
    if (!m || m.clientId !== clientId) throw new NotFoundException();
    return this.prisma.teamMember.update({ where: { id }, data: { isActive }, select });
  }

  async remove(id: string, principal: Principal) {
    const clientId = this.requireClient(principal);
    const m = await this.prisma.teamMember.findUnique({ where: { id }, select: { clientId: true } });
    if (!m || m.clientId !== clientId) throw new NotFoundException();
    await this.prisma.teamMember.delete({ where: { id } });
    return { ok: true };
  }

  private requireClient(principal: Principal): string {
    if (principal.type === 'CLIENT') return principal.id;
    if (principal.type === 'TEAM_MEMBER') return principal.clientId;
    throw new ForbiddenException();
  }
}

const select = {
  id: true,
  clientId: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;
