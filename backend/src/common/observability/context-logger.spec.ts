import { jest } from '@jest/globals';
import { RequestContextService } from './request-context.service.js';
import { RequestContextStorage } from './request-context.storage.js';
import { ContextLogger } from './context-logger.js';

describe('ContextLogger', () => {
  let output: string;
  let writeSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    output = '';
    writeSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        output += chunk.toString();
        return true;
      });
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it('adds request and active trace identifiers without including sensitive data', () => {
    const storage = new RequestContextStorage();
    const logger = new ContextLogger(new RequestContextService(storage));

    storage.run(
      {
        requestId: 'request-1',
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      },
      () =>
        logger.event('info', 'Order created', {
          operation: 'orders.create',
        }),
    );

    expect(JSON.parse(output)).toMatchObject({
      level: 'info',
      message: 'Order created',
      requestId: 'request-1',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      operation: 'orders.create',
    });
    expect(output).not.toContain('password');
  });

  it('works outside an HTTP request context', () => {
    const logger = new ContextLogger(
      new RequestContextService(new RequestContextStorage()),
    );

    logger.event('warn', 'Background task completed');

    expect(JSON.parse(output)).toEqual({
      level: 'warn',
      message: 'Background task completed',
    });
  });
});
