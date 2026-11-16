import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OrderStatus } from '../../../common/enums/order.enums.js';
import { PortfolioRepository } from '../repositories/portfolio.repository.js';
import {
  PortfolioInstrumentRepositoryDto,
  PortfolioOrderRepositoryDto,
  PortfolioRepositoryResponseDto,
} from '../repositories/dto/portfolio-repository-response.dto.js';
import { PortfolioService } from './portfolio.service.js';

describe('PortfolioService', () => {
  let service: PortfolioService;
  const repository = {
    findByUserId: jest.fn<PortfolioRepository['findByUserId']>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        PortfolioService,
        { provide: PortfolioRepository, useValue: repository },
      ],
    }).compile();
    service = module.get(PortfolioService);
  });

  it('calculates available cash, account value, filled holdings, and daily return', async () => {
    const stock = new PortfolioInstrumentRepositoryDto(
      47,
      'BBAR',
      'Banco Frances',
      'ACCIONES',
      110,
      100,
    );
    const cash = new PortfolioInstrumentRepositoryDto(
      66,
      'ARS',
      'PESOS',
      'MONEDA',
      1,
      1,
    );
    repository.findByUserId.mockResolvedValue(
      new PortfolioRepositoryResponseDto(1, true, [
        new PortfolioOrderRepositoryDto(66, 1000, 1, 'CASH_IN', 'FILLED', cash),
        new PortfolioOrderRepositoryDto(66, 100, 1, 'CASH_OUT', 'FILLED', cash),
        new PortfolioOrderRepositoryDto(47, 2, 100, 'BUY', 'FILLED', stock),
        new PortfolioOrderRepositoryDto(47, 1, 50, 'BUY', 'NEW', stock),
      ]),
    );

    const result = await service.getPortfolio(1);

    expect(result).toMatchObject({
      totalAccountValueArs: 920,
      availableCashArs: 650,
      positions: [
        {
          instrumentId: 47,
          quantity: 2,
          marketValueArs: 220,
          dailyReturnPercent: 10,
        },
      ],
    });
  });

  it('does not count rejected orders as movements or positions', async () => {
    repository.findByUserId.mockResolvedValue(
      new PortfolioRepositoryResponseDto(1, true, [
        new PortfolioOrderRepositoryDto(
          47,
          5,
          100,
          'BUY',
          OrderStatus.Rejected,
          new PortfolioInstrumentRepositoryDto(
            47,
            'BBAR',
            'Banco Frances',
            'ACCIONES',
            110,
            100,
          ),
        ),
      ]),
    );

    await expect(service.getPortfolio(1)).resolves.toMatchObject({
      totalAccountValueArs: 0,
      availableCashArs: 0,
      positions: [],
    });
  });

  it('returns not found when the user does not exist', async () => {
    repository.findByUserId.mockResolvedValue(
      new PortfolioRepositoryResponseDto(999, false, []),
    );

    await expect(service.getPortfolio(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
