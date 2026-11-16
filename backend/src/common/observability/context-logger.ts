import { Injectable } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { RequestContextService } from './request-context.service.js';

export type LogLevel =
  'info' | 'warn' | 'error' | 'debug' | 'verbose' | 'fatal';
export type LogAttributes = Readonly<
  Record<string, string | number | boolean | null>
>;

@Injectable()
export class ContextLogger implements LoggerService {
  constructor(private readonly requestContext: RequestContextService) {}

  log(message: unknown, ..._optionalParams: unknown[]): void {
    this.write('info', message);
  }

  error(message: unknown, ..._optionalParams: unknown[]): void {
    this.write('error', message);
  }

  warn(message: unknown, ..._optionalParams: unknown[]): void {
    this.write('warn', message);
  }

  debug(message: unknown, ..._optionalParams: unknown[]): void {
    this.write('debug', message);
  }

  verbose(message: unknown, ..._optionalParams: unknown[]): void {
    this.write('verbose', message);
  }

  fatal(message: unknown, ..._optionalParams: unknown[]): void {
    this.write('fatal', message);
  }

  event(
    level: LogLevel,
    message: string,
    attributes: LogAttributes = {},
  ): void {
    this.write(level, message, attributes);
  }

  private write(
    level: LogLevel,
    message: unknown,
    attributes: LogAttributes = {},
  ): void {
    const requestId = this.requestContext.getRequestId();
    const traceId = this.requestContext.getTraceId();
    const spanId = this.requestContext.getSpanId();
    const safeMessage =
      typeof message === 'string'
        ? message
        : message instanceof Error
          ? message.name
          : 'Application log';

    process.stdout.write(
      `${JSON.stringify({
        level,
        message: safeMessage,
        ...(requestId ? { requestId } : {}),
        ...(traceId ? { traceId } : {}),
        ...(spanId ? { spanId } : {}),
        ...attributes,
      })}\n`,
    );
  }
}
