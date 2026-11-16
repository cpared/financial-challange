import type { Request, Response } from 'express';
import { RequestContextMiddleware } from './request-context.middleware.js';
import { RequestContextService } from './request-context.service.js';
import { RequestContextStorage } from './request-context.storage.js';

function request(headers: Record<string, string>): Request {
  return { headers } as Request;
}

function response(): {
  readonly value: Response;
  readonly headers: Record<string, string>;
  readonly finish: () => void;
} {
  const headers: Record<string, string> = {};
  const finishCallbacks: Array<() => void> = [];
  return {
    headers,
    finish: () => finishCallbacks.forEach((callback) => callback()),
    value: {
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
      once: (_event: string, callback: () => void) => {
        finishCallbacks.push(callback);
      },
      statusCode: 200,
    } as unknown as Response,
  };
}

describe('RequestContextMiddleware', () => {
  let storage: RequestContextStorage;
  let middleware: RequestContextMiddleware;

  beforeEach(() => {
    storage = new RequestContextStorage();
    middleware = new RequestContextMiddleware(storage);
  });

  it('creates a UUID request ID and a trace ID when headers are absent', () => {
    const res = response();
    let requestId: string | undefined;
    let traceId: string | undefined;
    middleware.use(request({}), res.value, () => {
      const requestContext = new RequestContextService(storage).getContext();
      requestId = requestContext?.requestId;
      traceId = requestContext?.traceId;
    });
    res.finish();

    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(res.headers['X-Request-ID']).toBe(requestId);
  });

  it('preserves valid identifiers and replaces malformed request IDs', () => {
    const validResponse = response();
    middleware.use(
      request({
        'x-request-id': 'req-1234',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      }),
      validResponse.value,
      () => {
        expect(new RequestContextService(storage).getContext()).toMatchObject({
          requestId: 'req-1234',
          traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        });
      },
    );
    validResponse.finish();
    expect(validResponse.headers['X-Request-ID']).toBe('req-1234');

    const invalidResponse = response();
    middleware.use(
      request({ 'x-request-id': 'bad\r\nid' }),
      invalidResponse.value,
      () => {
        const requestId = new RequestContextService(storage).getRequestId();
        expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
        expect(requestId).not.toBe('bad\r\nid');
      },
    );
    invalidResponse.finish();
  });

  it('starts a new trace when the incoming traceparent is malformed', () => {
    const res = response();
    let traceId: string | undefined;

    middleware.use(
      request({
        traceparent: '00-00000000000000000000000000000000-00f067aa0ba902b7-01',
      }),
      res.value,
      () => {
        traceId = new RequestContextService(storage).getTraceId();
      },
    );
    res.finish();

    expect(traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(traceId).not.toBe('00000000000000000000000000000000');
  });

  it('keeps asynchronous contexts isolated between concurrent requests', async () => {
    const handle = (
      requestId: string,
      delay: number,
    ): Promise<string | undefined> =>
      new Promise((resolve) => {
        const res = response();
        middleware.use(
          request({ 'x-request-id': requestId }),
          res.value,
          () => {
            setTimeout(() => {
              const currentRequestId = new RequestContextService(
                storage,
              ).getRequestId();
              res.finish();
              resolve(currentRequestId);
            }, delay);
          },
        );
      });

    await expect(
      Promise.all([handle('request-a', 10), handle('request-b', 1)]),
    ).resolves.toEqual(['request-a', 'request-b']);
    expect(storage.getContext()).toBeUndefined();
  });
});
