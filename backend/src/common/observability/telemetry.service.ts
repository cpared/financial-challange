import { Injectable } from '@nestjs/common';
import { context, SpanStatusCode, trace } from '@opentelemetry/api';

export type SpanAttributes = Readonly<
  Record<string, string | number | boolean>
>;

@Injectable()
export class TelemetryService {
  async runInSpan<T>(
    name: string,
    attributes: SpanAttributes,
    operation: () => Promise<T>,
  ): Promise<T> {
    const span = trace
      .getTracer('cocos-challenge-backend')
      .startSpan(name, { attributes });
    const activeContext = trace.setSpan(context.active(), span);
    return context.with(activeContext, async () => {
      try {
        return await operation();
      } catch (error) {
        span.recordException({
          name: error instanceof Error ? error.name : 'UnknownError',
          message: 'Operation failed',
        });
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: 'Operation failed',
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
