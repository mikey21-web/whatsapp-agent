import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request } from 'express';
import type { Principal } from '../auth/principal';

/**
 * Logs every state-changing request (POST/PATCH/PUT/DELETE) with the
 * authenticated principal, method, path, and response status.
 *
 * This is the audit trail for admin actions. In production, pipe these
 * logs to a SIEM or append-only log store.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest<Request & { principal?: Principal }>();
    const { method, originalUrl } = req;
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) return next.handle();

    const principal = req.principal;
    const actor = principal
      ? `${principal.type}:${principal.id}`
      : 'anonymous';
    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0] ?? req.ip ?? '?').trim();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(`${method} ${originalUrl} actor=${actor} ip=${ip} status=ok`);
        },
        error: (err: Error) => {
          this.logger.warn(
            `${method} ${originalUrl} actor=${actor} ip=${ip} status=error msg=${err.message}`,
          );
        },
      }),
    );
  }
}
