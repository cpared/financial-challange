import { jest } from '@jest/globals';
import {
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrderSide, OrderStatus } from '../../../common/enums/order.enums.js';
import { PortfolioRepository } from '../repositories/portfolio.repository.js';
import {
  PortfolioInstrumentRepositoryDto,
  PortfolioOrderRepositoryDto,
  PortfolioRepositoryResponseDto,
} from '../repositories/dto/portfolio-repository-response.dto.js';
import { PortfolioService } from './portfolio.service.js';
import { PortfolioCalculator } from '../domain/portfolio-calculator.js';
import { PortfolioValidator } from '../domain/portfolio-validator.js';
import { CashCalculator } from '../domain/cash-calculator.js';
import { PositionCalculator } from '../domain/position-calculator.js';
import { COST_BASIS_STRATEGY } from '../domain/cost-basis/cost-basis.strategy.js';
import { WeightedAverageStrategy } from '../domain/cost-basis/weighted-average.strategy.js';

const userId = 1;
const instrumentId = 47;
const firstTradeTime = new Date('2026-01-01T10:00:00.000Z');

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
        PortfolioCalculator,
        PortfolioValidator,
        CashCalculator,
        PositionCalculator,
        WeightedAverageStrategy,
        { provide: COST_BASIS_STRATEGY, useExisting: WeightedAverageStrategy },
        { provide: PortfolioRepository, useValue: repository },
      ],
    }).compile();
    service = module.get(PortfolioService);
  });

  it('calculates total and daily returns for a profitable position', async () => {
    repository.findByUserId.mockResolvedValue(
      portfolio([
        trade({
          side: OrderSide.Buy,
          size: 2,
          price: '100.00',
          close: '110.00',
          previousClose: '100.00',
        }),
      ]),
    );

    await expect(service.getPortfolio(userId)).resolves.toMatchObject({
      positions: [
        {
          quantity: 2,
          marketValueArs: '220.00',
          totalReturnArs: '20.00',
          totalReturnPercent: '10.00',
          dailyReturnPercent: '10.00',
        },
      ],
    });
  });

  it('reports a negative total return independently from the daily return', async () => {
    repository.findByUserId.mockResolvedValue(
      portfolio([
        trade({
          side: OrderSide.Buy,
          size: 2,
          price: '100.00',
          close: '90.00',
          previousClose: '100.00',
        }),
      ]),
    );

    await expect(service.getPortfolio(userId)).resolves.toMatchObject({
      positions: [
        {
          marketValueArs: '180.00',
          totalReturnArs: '-20.00',
          totalReturnPercent: '-10.00',
          dailyReturnPercent: '-10.00',
        },
      ],
    });
  });

  it('uses the weighted average of multiple purchases', async () => {
    repository.findByUserId.mockResolvedValue(
      portfolio([
        trade({ id: 1, side: OrderSide.Buy, size: 1, price: '10.00' }),
        trade({
          id: 2,
          side: OrderSide.Buy,
          size: 1,
          price: '20.00',
          close: '20.00',
          previousClose: '20.00',
          datetime: new Date('2026-01-02T10:00:00.000Z'),
        }),
      ]),
    );

    await expect(service.getPortfolio(userId)).resolves.toMatchObject({
      positions: [
        {
          quantity: 2,
          marketValueArs: '40.00',
          totalReturnArs: '10.00',
          totalReturnPercent: '33.33',
        },
      ],
    });
  });

  it('reduces acquisition cost proportionally after a partial sale', async () => {
    repository.findByUserId.mockResolvedValue(
      portfolio([
        trade({ id: 1, side: OrderSide.Buy, size: 10, price: '10.00' }),
        trade({
          id: 2,
          side: OrderSide.Buy,
          size: 10,
          price: '20.00',
          datetime: new Date('2026-01-02T10:00:00.000Z'),
        }),
        trade({
          id: 3,
          side: OrderSide.Sell,
          size: 5,
          price: '15.00',
          datetime: new Date('2026-01-03T10:00:00.000Z'),
          close: '18.00',
        }),
      ]),
    );

    await expect(service.getPortfolio(userId)).resolves.toMatchObject({
      positions: [
        {
          quantity: 15,
          marketValueArs: '270.00',
          totalReturnArs: '45.00',
          totalReturnPercent: '20.00',
        },
      ],
    });
  });

  it('reduces weighted-average cost correctly after multiple partial sales', async () => {
    repository.findByUserId.mockResolvedValue(
      portfolio([
        trade({ id: 1, side: OrderSide.Buy, size: 10, price: '10.00' }),
        trade({
          id: 2,
          side: OrderSide.Buy,
          size: 10,
          price: '20.00',
          datetime: new Date('2026-01-02T10:00:00.000Z'),
        }),
        trade({
          id: 3,
          side: OrderSide.Sell,
          size: 5,
          price: '15.00',
          datetime: new Date('2026-01-03T10:00:00.000Z'),
        }),
        trade({
          id: 4,
          side: OrderSide.Sell,
          size: 5,
          price: '15.00',
          datetime: new Date('2026-01-04T10:00:00.000Z'),
          close: '18.00',
        }),
      ]),
    );

    await expect(service.getPortfolio(userId)).resolves.toMatchObject({
      positions: [
        {
          quantity: 10,
          marketValueArs: '180.00',
          totalReturnArs: '30.00',
          totalReturnPercent: '20.00',
        },
      ],
    });
  });

  it('omits a fully liquidated position and its market value', async () => {
    repository.findByUserId.mockResolvedValue(
      portfolio([
        trade({ id: 1, side: OrderSide.Buy, size: 3, price: '100.00' }),
        trade({
          id: 2,
          side: OrderSide.Sell,
          size: 3,
          price: '120.00',
          datetime: new Date('2026-01-02T10:00:00.000Z'),
          close: null,
          previousClose: null,
        }),
      ]),
    );

    await expect(service.getPortfolio(userId)).resolves.toMatchObject({
      positions: [],
    });
  });

  it('excludes NEW, REJECTED, and CANCELLED trades from quantity and cost basis', async () => {
    repository.findByUserId.mockResolvedValue(
      portfolio([
        trade({ id: 1, side: OrderSide.Buy, size: 2, price: '100.00' }),
        trade({
          id: 2,
          side: OrderSide.Buy,
          size: 100,
          price: '1.00',
          status: OrderStatus.New,
        }),
        trade({
          id: 3,
          side: OrderSide.Buy,
          size: 100,
          price: '1.00',
          status: OrderStatus.Rejected,
        }),
        trade({
          id: 4,
          side: OrderSide.Sell,
          size: 100,
          price: '1.00',
          status: OrderStatus.Cancelled,
          datetime: new Date('2026-01-02T10:00:00.000Z'),
        }),
      ]),
    );

    await expect(service.getPortfolio(userId)).resolves.toMatchObject({
      positions: [
        {
          quantity: 2,
          marketValueArs: '220.00',
          totalReturnArs: '20.00',
          totalReturnPercent: '10.00',
        },
      ],
    });
  });

  it.each([null, 0, -1])(
    'rejects FILLED trades with invalid size %s',
    async (size) => {
      repository.findByUserId.mockResolvedValue(
        portfolio([
          trade({
            side: OrderSide.Buy,
            size,
            price: '100.00',
          }),
        ]),
      );

      await expect(service.getPortfolio(userId)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    },
  );

  it('rejects FILLED trades with a missing instrument id or relation', async () => {
    repository.findByUserId.mockResolvedValue(
      portfolio([
        trade({
          side: OrderSide.Buy,
          size: 1,
          price: '100.00',
          instrumentId: null,
          instrument: null,
        }),
      ]),
    );
    await expect(service.getPortfolio(userId)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );

    repository.findByUserId.mockResolvedValue(
      portfolio([
        trade({
          side: OrderSide.Buy,
          size: 1,
          price: '100.00',
          instrument: null,
        }),
      ]),
    );
    await expect(service.getPortfolio(userId)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('rejects FILLED trades without a valid execution price', async () => {
    for (const price of [null, '0.00', '-1.00', '1.001']) {
      repository.findByUserId.mockResolvedValue(
        portfolio([
          trade({
            side: OrderSide.Buy,
            size: 1,
            price,
          }),
        ]),
      );
      await expect(service.getPortfolio(userId)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    }
  });

  it('reports unavailable or invalid market close for an open position', async () => {
    for (const close of [null]) {
      repository.findByUserId.mockResolvedValue(
        portfolio([
          trade({
            side: OrderSide.Buy,
            size: 1,
            price: '100.00',
            close,
          }),
        ]),
      );
      await expect(service.getPortfolio(userId)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    }

    for (const close of ['0.00', '-1.00']) {
      repository.findByUserId.mockResolvedValue(
        portfolio([
          trade({
            side: OrderSide.Buy,
            size: 1,
            price: '100.00',
            close,
          }),
        ]),
      );
      await expect(service.getPortfolio(userId)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    }
  });

  it('reports missing and invalid previous close for an open position', async () => {
    repository.findByUserId.mockResolvedValue(
      portfolio([
        trade({
          side: OrderSide.Buy,
          size: 1,
          price: '100.00',
          previousClose: null,
        }),
      ]),
    );
    await expect(service.getPortfolio(userId)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    for (const previousClose of ['0.00', '-1.00', '100000000.00']) {
      repository.findByUserId.mockResolvedValue(
        portfolio([
          trade({
            side: OrderSide.Buy,
            size: 1,
            price: '100.00',
            previousClose,
          }),
        ]),
      );
      await expect(service.getPortfolio(userId)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    }
  });

  it('rejects a negative net position instead of omitting it', async () => {
    repository.findByUserId.mockResolvedValue(
      portfolio([
        trade({ id: 1, side: OrderSide.Buy, size: 1, price: '100.00' }),
        trade({
          id: 2,
          side: OrderSide.Sell,
          size: 2,
          price: '100.00',
          datetime: new Date('2026-01-02T10:00:00.000Z'),
        }),
      ]),
    );

    await expect(service.getPortfolio(userId)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('rejects a calculated market value that cannot be represented to cents by the API number contract', async () => {
    repository.findByUserId.mockResolvedValue(
      portfolio([
        trade({
          side: OrderSide.Buy,
          size: MAX_INT,
          price: '99999999.99',
          close: '99999999.99',
          previousClose: '99999999.99',
        }),
      ]),
    );

    await expect(service.getPortfolio(userId)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('returns a valid empty portfolio when the user has no positions', async () => {
    repository.findByUserId.mockResolvedValue(portfolio([]));

    await expect(service.getPortfolio(userId)).resolves.toMatchObject({
      totalAccountValueArs: '0.00',
      availableCashArs: '0.00',
      positions: [],
    });
  });

  it('calculates a valid cash-only portfolio', async () => {
    const cashInstrument = instrument({
      id: 66,
      ticker: 'ARS',
      type: 'MONEDA',
      close: '1.00',
      previousClose: '1.00',
    });
    repository.findByUserId.mockResolvedValue(
      portfolio([
        new PortfolioOrderRepositoryDto(
          1,
          66,
          1000,
          '1.00',
          'CASH_IN',
          OrderStatus.Filled,
          firstTradeTime,
          cashInstrument,
        ),
        new PortfolioOrderRepositoryDto(
          2,
          66,
          100,
          '1.00',
          'CASH_OUT',
          OrderStatus.Filled,
          new Date('2026-01-02T10:00:00.000Z'),
          cashInstrument,
        ),
      ]),
    );

    await expect(service.getPortfolio(userId)).resolves.toMatchObject({
      totalAccountValueArs: '900.00',
      availableCashArs: '900.00',
      positions: [],
    });
  });

  it('returns not found when the user does not exist', async () => {
    repository.findByUserId.mockResolvedValue(
      new PortfolioRepositoryResponseDto(userId, false, []),
    );

    await expect(service.getPortfolio(userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

function portfolio(
  orders: PortfolioOrderRepositoryDto[],
): PortfolioRepositoryResponseDto {
  return new PortfolioRepositoryResponseDto(userId, true, orders);
}

const MAX_INT = 2_147_483_647;

function instrument(
  overrides: Partial<PortfolioInstrumentRepositoryDto> = {},
): PortfolioInstrumentRepositoryDto {
  return new PortfolioInstrumentRepositoryDto(
    overrides.id ?? instrumentId,
    overrides.ticker ?? 'BBAR',
    overrides.name ?? 'Banco Frances',
    overrides.type ?? 'ACCIONES',
    overrides.close === undefined ? '110.00' : overrides.close,
    overrides.previousClose === undefined ? '100.00' : overrides.previousClose,
  );
}

function trade(options: {
  readonly id?: number;
  readonly instrumentId?: number | null;
  readonly instrument?: PortfolioInstrumentRepositoryDto | null;
  readonly size: number | null;
  readonly price: string | null;
  readonly side: OrderSide.Buy | OrderSide.Sell;
  readonly status?: string;
  readonly datetime?: Date | null;
  readonly close?: string | null;
  readonly previousClose?: string | null;
}): PortfolioOrderRepositoryDto {
  const orderInstrument =
    options.instrument === undefined
      ? instrument({
          close: options.close === undefined ? '110.00' : options.close,
          previousClose:
            options.previousClose === undefined
              ? '100.00'
              : options.previousClose,
        })
      : options.instrument;
  return new PortfolioOrderRepositoryDto(
    options.id ?? 1,
    options.instrumentId === undefined ? instrumentId : options.instrumentId,
    options.size,
    options.price,
    options.side,
    options.status ?? OrderStatus.Filled,
    options.datetime === undefined ? firstTradeTime : options.datetime,
    orderInstrument,
  );
}
