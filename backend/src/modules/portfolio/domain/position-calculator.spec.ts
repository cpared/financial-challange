import { OrderSide } from '../../../common/enums/order.enums.js';
import type {
  FilledTrade,
  PositionCostBasis,
} from './cost-basis/cost-basis.strategy.js';
import { rational } from './cost-basis/weighted-average.strategy.js';
import { PositionCalculator } from './position-calculator.js';
import { PortfolioInstrumentRepositoryDto } from '../repositories/dto/portfolio-repository-response.dto.js';
import { WeightedAverageStrategy } from './cost-basis/weighted-average.strategy.js';
import type { ValidatedOpenPosition } from './portfolio-validator.js';

describe('PositionCalculator', () => {
  it('values positions and calculates total and daily returns', () => {
    const calculator = new PositionCalculator(new WeightedAverageStrategy());
    const instrument = new PortfolioInstrumentRepositoryDto(
      47,
      'TEST',
      'Test asset',
      'ACCIONES',
      '110.00',
      '100.00',
    );
    const costBasis: PositionCostBasis = {
      quantity: 2n,
      acquisitionCostInCents: rational(20_000n, 1n),
      unitCostInCents: rational(10_000n, 1n),
    };
    const openPosition: ValidatedOpenPosition = {
      instrumentId: 47,
      instrument,
      costBasis,
      closeInCents: 11_000n,
      previousCloseInCents: 10_000n,
    };

    expect(calculator.valuePositions([openPosition])).toMatchObject([
      {
        instrumentId: 47,
        quantity: 2,
        marketValueInCents: 22_000n,
        totalReturnArs: '20.00',
        totalReturnPercent: '10.00',
        dailyReturnPercent: '10.00',
      },
    ]);
  });

  it('passes validated trade movements to the selected cost basis strategy', () => {
    const calculator = new PositionCalculator(new WeightedAverageStrategy());
    const trades: FilledTrade[] = [
      {
        instrumentId: 47,
        orderId: 1,
        datetime: new Date('2026-01-01T10:00:00.000Z'),
        side: OrderSide.Buy,
        quantity: 2n,
        priceInCents: 10_000n,
      },
    ];

    expect(calculator.calculateCostBases(trades).get(47)?.quantity).toBe(2n);
  });
});
