import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { PortfolioController } from './portfolio.controller.js';
import { PortfolioService } from '../services/portfolio.service.js';
import { PortfolioServiceResponseDto } from '../services/dto/portfolio-service-response.dto.js';

describe('PortfolioController', () => {
  let controller: PortfolioController;
  const service = {
    getPortfolio: jest.fn<PortfolioService['getPortfolio']>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [PortfolioController],
      providers: [{ provide: PortfolioService, useValue: service }],
    }).compile();
    controller = module.get(PortfolioController);
  });

  it('maps the service response to the HTTP contract', async () => {
    service.getPortfolio.mockResolvedValue(
      new PortfolioServiceResponseDto(1, '920.00', '650.00', [
        {
          instrumentId: 47,
          ticker: 'BBAR',
          name: 'Banco Frances',
          quantity: 2,
          marketValueArs: '220.00',
          totalReturnArs: '20.00',
          totalReturnPercent: '10.00',
          dailyReturnPercent: '10.00',
        },
      ]),
    );

    await expect(controller.getPortfolio(1)).resolves.toMatchObject({
      userId: 1,
      totalAccountValueArs: 920,
      availableCashArs: 650,
      positions: [
        {
          quantity: 2,
          marketValueArs: 220,
          totalReturnArs: 20,
          totalReturnPercent: 10,
          dailyReturnPercent: 10,
        },
      ],
    });
    expect(service.getPortfolio).toHaveBeenCalledWith(1);
  });
});
