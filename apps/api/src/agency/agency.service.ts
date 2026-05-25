import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import type { CreateAgencyDto, UpdateAgencyDto } from './agency.dto';

@Injectable()
export class AgencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  list() {
    return this.prisma.agency.findMany({
      orderBy: { createdAt: 'desc' },
      select: agencySelect,
    });
  }

  async create(dto: CreateAgencyDto) {
    const existing = await this.prisma.agency.findFirst({
      where: { OR: [{ email: dto.email }, { slug: dto.slug }] },
    });
    if (existing) throw new ConflictException('Email or slug in use');
    const password = await this.auth.hashPassword(dto.password);
    return this.prisma.agency.create({
      data: {
        email: dto.email,
        password,
        name: dto.name,
        slug: dto.slug,
        brandColor: dto.brandColor ?? '#000000',
        plan: dto.plan ?? 'STARTER',
      },
      select: agencySelect,
    });
  }

  async update(id: string, dto: UpdateAgencyDto) {
    await this.requireAgency(id);
    return this.prisma.agency.update({
      where: { id },
      data: dto,
      select: agencySelect,
    });
  }

  async setActive(id: string, isActive: boolean) {
    await this.requireAgency(id);
    return this.prisma.agency.update({ where: { id }, data: { isActive }, select: agencySelect });
  }

  async remove(id: string) {
    await this.requireAgency(id);
    await this.prisma.agency.delete({ where: { id } });
    return { ok: true };
  }

  private async requireAgency(id: string) {
    const a = await this.prisma.agency.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Agency not found');
    return a;
  }
}

const agencySelect = {
  id: true,
  name: true,
  slug: true,
  email: true,
  brandColor: true,
  logo: true,
  customDomain: true,
  plan: true,
  isActive: true,
  createdAt: true,
} as const;
