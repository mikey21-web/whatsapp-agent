import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { promises as dns } from 'dns';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../config/env';
import type { Principal } from '../auth/principal';

const APEX_HOST = new URL(env.WEB_PUBLIC_URL).hostname;

@Injectable()
export class DomainService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve a hostname to its branding bundle. Used by the web app's host
   * detection middleware to apply agency-specific theme.
   */
  async resolve(host: string) {
    const cleaned = host.toLowerCase().split(':')[0];
    if (!cleaned || cleaned === APEX_HOST.toLowerCase()) return null;
    const ag = await this.prisma.agency.findUnique({
      where: { customDomain: cleaned },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        brandColor: true,
        customDomain: true,
        isActive: true,
      },
    });
    if (!ag || !ag.isActive) return null;
    return ag;
  }

  /**
   * Caddy `on_demand` ask endpoint. Returns 200 if we should issue a cert
   * for this host, anything else => Caddy refuses.
   */
  async isDomainAllowed(host: string): Promise<boolean> {
    const r = await this.resolve(host);
    return !!r;
  }

  async setCustomDomain(p: Principal, hostname: string) {
    if (p.type !== 'AGENCY') throw new ForbiddenException('Agency context required');
    const cleaned = hostname.trim().toLowerCase();
    if (!isValidHostname(cleaned)) throw new ConflictException('Invalid hostname');
    const conflict = await this.prisma.agency.findFirst({
      where: { customDomain: cleaned, NOT: { id: p.id } },
    });
    if (conflict) throw new ConflictException('Domain already claimed');
    return this.prisma.agency.update({
      where: { id: p.id },
      data: { customDomain: cleaned },
      select: { customDomain: true, brandColor: true },
    });
  }

  async clearCustomDomain(p: Principal) {
    if (p.type !== 'AGENCY') throw new ForbiddenException();
    return this.prisma.agency.update({
      where: { id: p.id },
      data: { customDomain: null },
      select: { customDomain: true },
    });
  }

  /**
   * DNS verification: resolves the hostname's CNAME and confirms it points to
   * our apex. Returns the records we found so the UI can show the user.
   */
  async verifyDns(p: Principal): Promise<{
    ok: boolean;
    expected: string;
    cname: string[];
    a: string[];
    detail?: string;
  }> {
    if (p.type !== 'AGENCY') throw new ForbiddenException();
    const ag = await this.prisma.agency.findUnique({
      where: { id: p.id },
      select: { customDomain: true },
    });
    if (!ag?.customDomain) throw new NotFoundException('No custom domain set');

    const expected = APEX_HOST.toLowerCase();
    let cname: string[] = [];
    let a: string[] = [];
    try {
      cname = (await dns.resolveCname(ag.customDomain)).map((c) => c.toLowerCase());
    } catch {
      /* no CNAME record */
    }
    try {
      a = await dns.resolve4(ag.customDomain);
    } catch {
      /* no A record */
    }
    const ok = cname.some((c) => c === expected || c.endsWith(`.${expected}`));
    return {
      ok,
      expected,
      cname,
      a,
      detail: ok
        ? 'CNAME points to the platform. SSL will be issued automatically on first request.'
        : `Add a CNAME record from ${ag.customDomain} to ${expected}`,
    };
  }
}

function isValidHostname(s: string): boolean {
  return /^(?=.{1,253}$)(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/.test(s);
}
