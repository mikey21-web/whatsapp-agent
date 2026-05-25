import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Principal } from '../auth/principal';

export const PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(PUBLIC_KEY, true);
export const Roles = (...roles: Principal['type'][]) => SetMetadata(ROLES_KEY, roles);

export const CurrentPrincipal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Principal => {
    const req = ctx.switchToHttp().getRequest();
    return req.principal as Principal;
  },
);
