import { randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { context, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import { RequestContextStorage } from './request-context.storage.js';
import type { RequestContext } from './request-context.types.js';

const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const traceparentPattern =
  /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

interface ParsedTraceparent {
  readonly traceId: string;
  readonly spanId: string;
  readonly traceFlags: number;
}

export function validRequestId(value: string | undefined): string | undefined {
  return value && requestIdPattern.test(value) ? value : undefined;
}

export function parseTraceparent(
  value: string | undefined,
): ParsedTraceparent | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = traceparentPattern.exec(value);
  if (
    !parsed ||
    parsed[1] !== '00' ||
    /^0+$/.test(parsed[2] ?? '') ||
    /^0+$/.test(parsed[3] ?? '')
  ) {
    return undefined;
  }
  return {
    traceId: parsed[2]!,
    spanId: parsed[3]!,
    traceFlags: Number.parseInt(parsed[4]!, 16),
  };
}

function requestHeader(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return typeof value === 'string' ? value : undefined;
}

function createResponseTraceparent(
  traceId: string,
  spanId: string,
  flags: number,
): string {
  return `00-${traceId}-${spanId}-${flags.toString(16).padStart(2, '0')}`;
}

function validSpanContext(
  spanContext: ReturnType<typeof trace.getSpanContext>,
): boolean {
  return Boolean(
    spanContext &&
    !/^0+$/.test(spanContext.traceId) &&
    !/^0+$/.test(spanContext.spanId),
  );
}

@Injectable()
export class RequestContextMiddleware {
  constructor(private readonly requestContextStorage: RequestContextStorage) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const incomingTraceparent = parseTraceparent(
      requestHeader(request, 'traceparent'),
    );
    const activeContext = context.active();
    const activeSpanContext = trace.getSpanContext(activeContext);
    const activeSpanIsRemoteParent =
      incomingTraceparent?.spanId === activeSpanContext?.spanId;
    const needsServerSpan =
      !validSpanContext(activeSpanContext) || activeSpanIsRemoteParent;
    const parentContext =
      needsServerSpan && incomingTraceparent
        ? trace.setSpanContext(activeContext, {
            traceId: incomingTraceparent.traceId,
            spanId: incomingTraceparent.spanId,
            traceFlags: incomingTraceparent.traceFlags,
            isRemote: true,
          })
        : activeContext;
    const serverSpan = needsServerSpan
      ? trace.getTracer('cocos-challenge-backend').startSpan(
          `HTTP ${request.method}`,
          {
            kind: SpanKind.SERVER,
            attributes: {
              'http.request.method': request.method,
              'url.path': '[REDACTED]',
            },
          },
          parentContext,
        )
      : undefined;
    const requestSpan = serverSpan ?? trace.getSpan(activeContext);
    const requestSpanContext = requestSpan?.spanContext();
    const traceId =
      (requestSpanContext && validSpanContext(requestSpanContext)
        ? requestSpanContext.traceId
        : undefined) ??
      incomingTraceparent?.traceId ??
      randomBytes(16).toString('hex');
    const requestContext: RequestContext = {
      requestId:
        validRequestId(requestHeader(request, 'x-request-id')) ?? randomUUID(),
      traceId,
    };

    response.setHeader('X-Request-ID', requestContext.requestId);
    if (requestSpanContext && validSpanContext(requestSpanContext)) {
      response.setHeader(
        'traceparent',
        createResponseTraceparent(
          requestSpanContext.traceId,
          requestSpanContext.spanId,
          requestSpanContext.traceFlags,
        ),
      );
    }

    if (serverSpan) {
      let ended = false;
      const endSpan = () => {
        if (ended) {
          return;
        }
        ended = true;
        serverSpan.setAttribute(
          'http.response.status_code',
          response.statusCode,
        );
        if (response.statusCode >= 500) {
          serverSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: 'HTTP request failed',
          });
        }
        serverSpan.end();
      };
      response.once('finish', endSpan);
      response.once('close', endSpan);
    }

    this.requestContextStorage.run(requestContext, () => {
      if (serverSpan) {
        context.with(trace.setSpan(activeContext, serverSpan), next);
        return;
      }
      next();
    });
  }
}
