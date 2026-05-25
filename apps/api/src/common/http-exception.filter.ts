import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorEnvelope {
  error: { code: string; message: string; details?: unknown };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ErrorEnvelope = {
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      const code = mapStatusToCode(status);
      if (typeof r === 'string') {
        body = { error: { code, message: r } };
      } else if (r && typeof r === 'object') {
        const obj = r as Record<string, unknown>;
        const message =
          typeof obj.message === 'string'
            ? obj.message
            : Array.isArray(obj.message)
              ? (obj.message as string[]).join(', ')
              : (obj.error as string) ?? 'Error';
        body = {
          error: {
            code: typeof obj.code === 'string' ? obj.code : code,
            message,
            details: obj.details ?? (Array.isArray(obj.message) ? obj.message : undefined),
          },
        };
      }
    } else if (exception instanceof Error) {
      this.logger.error(`${req.method} ${req.url} — ${exception.message}`, exception.stack);
    }

    res.status(status).json(body);
  }
}

function mapStatusToCode(status: number): string {
  switch (status) {
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'UNPROCESSABLE';
    case 429:
      return 'RATE_LIMITED';
    case 501:
      return 'NOT_IMPLEMENTED';
    default:
      return 'ERROR';
  }
}
