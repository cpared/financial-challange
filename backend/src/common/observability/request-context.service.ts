import { Injectable } from '@nestjs/common';
import { context, trace } from '@opentelemetry/api';
import { RequestContextStorage } from './request-context.storage.js';
import type { RequestContext } from './request-context.types.js';

@Injectable()
export class RequestContextService {
  constructor(private readonly requestContextStorage: RequestContextStorage) {}

  getRequestId(): string | undefined {
    return this.getContext()?.requestId;
  }

  getTraceId(): string | undefined {
    const spanContext = trace.getSpanContext(context.active());
    if (spanContext && !/^0+$/.test(spanContext.traceId)) {
      return spanContext.traceId;
    }
    return this.getContext()?.traceId;
  }

  getSpanId(): string | undefined {
    const spanContext = trace.getSpanContext(context.active());
    return spanContext && !/^0+$/.test(spanContext.spanId)
      ? spanContext.spanId
      : undefined;
  }

  getUserId(): number | undefined {
    return this.getContext()?.userId;
  }

  getContext(): RequestContext | undefined {
    return this.requestContextStorage.getContext();
  }
}
