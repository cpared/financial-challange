import { BadRequestException, Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { jest } from '@jest/globals';
import request from 'supertest';
import { ObservabilityModule } from './observability.module.js';
import { RequestContextService } from './request-context.service.js';

@Controller('request-context-test')
class RequestContextTestController {
  constructor(private readonly requestContext: RequestContextService) {}

  @Get()
  getContext() {
    return {
      requestId: this.requestContext.getRequestId(),
      traceId: this.requestContext.getTraceId(),
    };
  }

  @Get('error')
  throwExpectedError(): never {
    throw new BadRequestException('Invalid request');
  }

  @Get('internal-error')
  throwUnexpectedError(): never {
    throw new Error('sensitive database failure');
  }
}

@Module({
  imports: [ObservabilityModule],
  controllers: [RequestContextTestController],
})
class RequestContextTestModule {}

describe('Request context HTTP integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await NestFactory.create(RequestContextTestModule, { logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a context and returns its request ID for each request', async () => {
    const response = await request(app.getHttpServer())
      .get('/request-context-test')
      .expect(200);

    expect(response.body.requestId).toBe(response.headers['x-request-id']);
    expect(response.body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.body.traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('preserves valid request and trace identifiers from incoming headers', async () => {
    const response = await request(app.getHttpServer())
      .get('/request-context-test')
      .set('X-Request-ID', 'frontend-req-42')
      .set(
        'traceparent',
        '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      )
      .expect(200);

    expect(response.headers['x-request-id']).toBe('frontend-req-42');
    expect(response.body).toMatchObject({
      requestId: 'frontend-req-42',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
    });
  });

  it('isolates context across concurrent HTTP requests', async () => {
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .get('/request-context-test')
        .set('X-Request-ID', 'parallel-request-a'),
      request(app.getHttpServer())
        .get('/request-context-test')
        .set('X-Request-ID', 'parallel-request-b'),
    ]);

    expect(first.body.requestId).toBe('parallel-request-a');
    expect(second.body.requestId).toBe('parallel-request-b');
    expect(first.body.traceId).not.toBe(second.body.traceId);
  });

  it('logs client exceptions as errors and keeps their response bodies unchanged', async () => {
    const output = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const response = await request(app.getHttpServer())
      .get('/request-context-test/error')
      .set('X-Request-ID', 'error-request')
      .expect(400);

    expect(response.body).toEqual({
      statusCode: 400,
      message: 'Invalid request',
      error: 'Bad Request',
    });
    expect(response.headers['x-request-id']).toBe('error-request');
    expect(output).toHaveBeenCalledWith(
      expect.stringContaining('"level":"error"'),
    );
    output.mockRestore();
  });

  it('does not expose unexpected internal exception details', async () => {
    const output = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    const response = await request(app.getHttpServer())
      .get('/request-context-test/internal-error')
      .set('X-Request-ID', 'internal-error-request')
      .expect(500);

    expect(response.body).toEqual({
      statusCode: 500,
      message: 'Internal server error',
    });
    expect(output).toHaveBeenCalledWith(
      expect.stringContaining('"requestId":"internal-error-request","traceId"'),
    );
    expect(output).toHaveBeenCalledWith(
      expect.stringContaining('"level":"error"'),
    );
    expect(output.mock.calls.flat().join('')).not.toContain(
      'sensitive database failure',
    );
    output.mockRestore();
  });
});
