import { RequestMethod } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ObservabilityModule } from '../../common/observability/observability.module.js';
import { HealthModule } from './health.module.js';

describe('Health endpoint', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ObservabilityModule, HealthModule],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api/v1', {
      exclude: [{ path: 'ping', method: RequestMethod.GET }],
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('responds at /ping outside the API prefix and returns a request ID', async () => {
    const response = await request(app.getHttpServer())
      .get('/ping')
      .set('X-Request-ID', 'ping-request-42')
      .expect(200);

    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toBe('ping-request-42');
  });

  it('does not also expose the health route under the API prefix', async () => {
    await request(app.getHttpServer()).get('/api/v1/ping').expect(404);
  });
});
