import { OrderSide, OrderStatus } from '../../../common/enums/order.enums.js';
import { CashCalculator } from '../../../common/domain/cash/cash-calculator.js';
import { PositionQuantityCalculator } from '../../../common/domain/positions/position-quantity-calculator.js';
import { PortfolioValidator } from './portfolio-validator.js';
import { PortfolioDataIntegrityError } from './portfolio-errors.js';
import {
  PortfolioInstrumentRepositoryDto,
  PortfolioOrderRepositoryDto,
  PortfolioRepositoryResponseDto,
} from '../repositories/dto/portfolio-repository-response.dto.js';
import { WeightedAverageStrategy } from './cost-basis/weighted-average.strategy.js';
import { PortfolioCalculator } from './portfolio-calculator.js';
import { PositionCalculator } from './position-calculator.js';

describe('PortfolioCalculator', () => {
  it('integrates cash and position calculations into the portfolio result', () => {
    const instrument = new PortfolioInstrumentRepositoryDto(
      47,
      'TEST',
      'Test asset',
      'ACCIONES',
      '110.00',
      '100.00',
    );
    const order = new PortfolioOrderRepositoryDto(
      1,
      47,
      2,
      '100.00',
      OrderSide.Buy,
      OrderStatus.Filled,
      new Date('2026-01-01T10:00:00.000Z'),
      instrument,
    );
    const calculator = new PortfolioCalculator(
      new PortfolioValidator(),
      new CashCalculator(),
      new PositionQuantityCalculator(),
      new PositionCalculator(new WeightedAverageStrategy()),
    );

    expect(
      calculator.calculate(
        new PortfolioRepositoryResponseDto(1, true, [order]),
      ),
    ).toEqual({
      userId: 1,
      totalAccountValueArs: '20.00',
      availableCashArs: '-200.00',
      positions: [
        {
          instrumentId: 47,
          ticker: 'TEST',
          name: 'Test asset',
          quantity: 2,
          availableQuantity: 2n,
          marketValueArs: '220.00',
          totalReturnArs: '20.00',
          totalReturnPercent: '10.00',
          dailyReturnPercent: '10.00',
        },
      ],
    });
  });

  it('rejects FILLED orders with no associated instrument', () => {
    const calculator = new PortfolioCalculator(
      new PortfolioValidator(),
      new CashCalculator(),
      new PositionQuantityCalculator(),
      new PositionCalculator(new WeightedAverageStrategy()),
    );
    const invalidOrder = new PortfolioOrderRepositoryDto(
      1,
      null,
      1,
      '100.00',
      OrderSide.Buy,
      OrderStatus.Filled,
      new Date('2026-01-01T10:00:00.000Z'),
      null,
    );

    expect(() =>
      calculator.calculate(
        new PortfolioRepositoryResponseDto(1, true, [invalidOrder]),
      ),
    ).toThrow(PortfolioDataIntegrityError);
  });
});
