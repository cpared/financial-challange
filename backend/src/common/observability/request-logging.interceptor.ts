import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { context, trace } from '@opentelemetry/api';
import { catchError, finalize, Observable, throwError } from 'rxjs';
import { performance } from 'node:perf_hooks';
import { ContextLogger } from './context-logger.js';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: ContextLogger) {}

  intercept(
    executionContext: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const http = executionContext.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startTime = performance.now();
    const route = request.route
      ? `${request.baseUrl ?? ''}${request.route.path}`
      : 'unmatched';
    const span = trace.getSpan(context.active());
    span?.setAttribute('http.route', route);
    span?.setAttribute('http.request.method', request.method);
    let failed = false;

    return next.handle().pipe(
      catchError((error: unknown) => {
        failed = true;
        return throwError(() => error);
      }),
      finalize(() => {
        if (failed || response.statusCode >= 400) {
          return;
        }
        span?.setAttribute('http.response.status_code', response.statusCode);
        this.logger.event('info', 'HTTP request completed', {
          method: request.method,
          route,
          statusCode: response.statusCode,
          durationMs: Math.round((performance.now() - startTime) * 100) / 100,
        });
      }),
    );
  }
}
