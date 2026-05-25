import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PUBLIC_KEY, ROLES_KEY } from '../common/decorators';
import type { AccessTokenPayload, Principal } from './principal';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Missing bearer token');
    const token = header.slice('Bearer '.length);

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const principal = toPrincipal(payload);
    (req as Request & { principal: Principal }).principal = principal;

    const required = this.reflector.getAllAndOverride<Principal['type'][] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (required && required.length && !required.includes(principal.type)) {
      throw new UnauthorizedException('Insufficient role');
    }
    return true;
  }
}

function toPrincipal(p: AccessTokenPayload): Principal {
  switch (p.type) {
    case 'SUPER_ADMIN':
      return { type: 'SUPER_ADMIN', id: p.sub };
    case 'AGENCY':
      return { type: 'AGENCY', id: p.sub };
    case 'CLIENT':
      if (!p.agencyId) throw new UnauthorizedException('Malformed token');
      return { type: 'CLIENT', id: p.sub, agencyId: p.agencyId };
    case 'TEAM_MEMBER':
      if (!p.agencyId || !p.clientId || !p.role) throw new UnauthorizedException('Malformed token');
      return {
        type: 'TEAM_MEMBER',
        id: p.sub,
        agencyId: p.agencyId,
        clientId: p.clientId,
        role: p.role,
      };
  }
}
