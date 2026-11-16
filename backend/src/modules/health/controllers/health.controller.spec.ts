import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('returns an alive response without checking application dependencies', async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    const controller = module.get(HealthController);

    expect(controller.ping()).toEqual({ status: 'ok' });

    await module.close();
  });
});
