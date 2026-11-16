import {
  context,
  ROOT_CONTEXT,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from '@opentelemetry/sdk-trace';
import type { NextFunction, Request, Response } from 'express';
import { RequestContextMiddleware } from './request-context.middleware.js';
import { RequestContextStorage } from './request-context.storage.js';
import { TelemetryService } from './telemetry.service.js';

describe('TelemetryService', () => {
  const exporter = new InMemorySpanExporter();
  const provider = new TracerProvider({
    spanProcessors: [new SimpleSpanProcessor({ exporter })],
  });
  const telemetry = new TelemetryService();

  beforeAll(() => {
    context.setGlobalContextManager(
      new AsyncLocalStorageContextManager().enable(),
    );
    trace.setGlobalTracerProvider(provider);
  });

  afterAll(async () => {
    await provider.shutdown();
    context.disable();
  });

  beforeEach(() => {
    exporter.reset();
  });

  it('creates nested spans with parent-child relationships', async () => {
    await telemetry.runInSpan('portfolio.get', {}, async () => {
      const parent = trace.getSpan(context.active())?.spanContext();
      expect(parent).toBeDefined();
      await telemetry.runInSpan('db.portfolio.find_by_user', {}, async () => {
        expect(trace.getSpan(context.active())?.spanContext()?.traceId).toBe(
          parent?.traceId,
        );
      });
    });
    await provider.forceFlush();

    const spans = exporter.getFinishedSpans();
    const parentSpan = spans.find((span) => span.name === 'portfolio.get');
    const childSpan = spans.find(
      (span) => span.name === 'db.portfolio.find_by_user',
    );
    expect(parentSpan).toBeDefined();
    expect(childSpan?.parentSpanContext?.spanId).toBe(
      parentSpan?.spanContext().spanId,
    );
  });

  it('records a sanitized exception and marks the span as failed', async () => {
    await expect(
      telemetry.runInSpan('orders.create', {}, async () => {
        throw new Error('sensitive database detail');
      }),
    ).rejects.toThrow('sensitive database detail');
    await provider.forceFlush();

    const [span] = exporter.getFinishedSpans();
    expect(span?.status.code).toBe(SpanStatusCode.ERROR);
    expect(span?.events[0]?.attributes).toMatchObject({
      'exception.message': 'Operation failed',
      'exception.type': 'Error',
    });
    expect(JSON.stringify(span?.events)).not.toContain(
      'sensitive database detail',
    );
  });

  it('creates a server child span and returns its W3C traceparent', () => {
    const middleware = new RequestContextMiddleware(
      new RequestContextStorage(),
    );
    const headers: Record<string, string> = {};
    const finishCallbacks: Array<() => void> = [];
    const response = {
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
      once: (_event: string, callback: () => void) => {
        finishCallbacks.push(callback);
      },
      statusCode: 200,
    } as unknown as Response;
    const parentTraceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const parentSpanId = '00f067aa0ba902b7';
    const parentContext = trace.setSpanContext(ROOT_CONTEXT, {
      traceId: parentTraceId,
      spanId: parentSpanId,
      traceFlags: 1,
      isRemote: true,
    });

    context.with(parentContext, () => {
      middleware.use(
        {
          headers: {
            traceparent: `00-${parentTraceId}-${parentSpanId}-01`,
          },
          method: 'GET',
          url: '/users/1/portfolio?secret=value',
        } as unknown as Request,
        response,
        (() => undefined) as NextFunction,
      );
    });

    const [, traceId, spanId, flags] =
      /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/.exec(
        headers.traceparent ?? '',
      ) ?? [];
    expect(traceId).toBe(parentTraceId);
    expect(spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(spanId).not.toBe(parentSpanId);
    expect(flags).toBe('01');
    finishCallbacks.forEach((callback) => callback());
  });
});
