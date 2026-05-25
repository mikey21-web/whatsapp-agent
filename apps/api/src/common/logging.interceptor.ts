import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest<Request>();
    const started = Date.now();
    const { method, originalUrl } = req;
    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(`${method} ${originalUrl} ${Date.now() - started}ms`);
        },
        error: (err) => {
          this.logger.warn(`${method} ${originalUrl} ${Date.now() - started}ms ERR ${err?.message ?? ''}`);
        },
      }),
    );
  }
}
