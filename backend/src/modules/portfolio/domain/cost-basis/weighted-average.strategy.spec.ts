import { OrderSide } from '../../../../common/enums/order.enums.js';
import {
  calculateTotalPositionReturn,
  calculateWeightedAverageCostBasis,
  formatPercent,
  formatRationalCents,
  rational,
} from './weighted-average.strategy.js';

describe('WeightedAverageStrategy', () => {
  it('calculates return percentage as null when acquisition cost is zero', () => {
    const result = calculateTotalPositionReturn(100n, rational(0n, 1n));

    expect(formatRationalCents(result.profitInCents)).toBe('1.00');
    expect(result.returnPercent).toBeNull();
  });

  it('rounds monetary and percentage values half away from zero', () => {
    const result = calculateTotalPositionReturn(1n, rational(1n, 8n));

    expect(formatRationalCents(result.profitInCents)).toBe('0.01');
    expect(result.returnPercent).toBe('700.00');
    expect(formatPercent(1n, 800n)).toBe('0.13');
    expect(formatPercent(-1n, 800n)).toBe('-0.13');
  });

  it('retains exact fractional-cent cost through partial weighted-average sales', () => {
    const positions = calculateWeightedAverageCostBasis([
      {
        instrumentId: 47,
        orderId: 1,
        datetime: new Date('2026-01-01T10:00:00.000Z'),
        side: OrderSide.Buy,
        quantity: 1n,
        priceInCents: 1n,
      },
      {
        instrumentId: 47,
        orderId: 2,
        datetime: new Date('2026-01-02T10:00:00.000Z'),
        side: OrderSide.Buy,
        quantity: 2n,
        priceInCents: 2n,
      },
      {
        instrumentId: 47,
        orderId: 3,
        datetime: new Date('2026-01-03T10:00:00.000Z'),
        side: OrderSide.Sell,
        quantity: 1n,
        priceInCents: 2n,
      },
    ]);

    expect(positions.get(47)).toMatchObject({
      quantity: 2n,
      acquisitionCostInCents: { numerator: 10n, denominator: 3n },
    });
    expect(formatRationalCents(positions.get(47)!.acquisitionCostInCents)).toBe(
      '0.03',
    );
  });
});
