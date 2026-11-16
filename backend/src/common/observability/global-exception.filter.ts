import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Request, Response } from 'express';
import { context, SpanStatusCode, trace } from '@opentelemetry/api';
import { ContextLogger } from './context-logger.js';

@Catch()
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly logger: ContextLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      this.logger.event('error', 'Unhandled application exception', {
        exceptionType:
          exception instanceof Error ? exception.name : 'UnknownError',
      });
      throw exception;
    }

    const { httpAdapter } = this.httpAdapterHost;
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const responseBody =
      exceptionResponse === undefined
        ? { statusCode, message: 'Internal server error' }
        : typeof exceptionResponse === 'string'
          ? { statusCode, message: exceptionResponse }
          : exceptionResponse;

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const span = trace.getSpan(context.active());
      span?.recordException({
        name: exception instanceof Error ? exception.name : 'UnknownError',
        message: 'HTTP request failed',
      });
      span?.setStatus({
        code: SpanStatusCode.ERROR,
        message: 'HTTP request failed',
      });
    }

    const route = request.route
      ? `${request.baseUrl ?? ''}${request.route.path}`
      : 'unmatched';
    this.logger.event('error', 'HTTP request failed', {
      method: request.method,
      route,
      statusCode,
      exceptionType:
        exception instanceof Error ? exception.name : 'UnknownError',
    });

    if (!httpAdapter.isHeadersSent(response)) {
      httpAdapter.reply(response, responseBody, statusCode);
    }
  }
}
