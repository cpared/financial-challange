import { OrderSide, OrderStatus } from '../../enums/order.enums.js';
import { InvalidFinancialDataError } from '../financial-data-error.js';
import { PositionQuantityCalculator } from './position-quantity-calculator.js';
import type { PositionMovement } from './position.types.js';

describe('PositionQuantityCalculator', () => {
  const calculator = new PositionQuantityCalculator();

  it('calculates effective, reserved, and available shares per instrument', () => {
    const quantities = calculator.calculate([
      movement(47, OrderSide.Buy, OrderStatus.Filled, 10),
      movement(47, OrderSide.Sell, OrderStatus.Filled, 3),
      movement(47, OrderSide.Sell, OrderStatus.New, 2),
      movement(47, OrderSide.Sell, OrderStatus.Rejected, 20),
      movement(47, OrderSide.Sell, OrderStatus.Cancelled, 20),
      movement(52, OrderSide.Buy, OrderStatus.Filled, 4),
    ]);

    expect(quantities.get(47)).toEqual({
      effectiveQuantity: 7n,
      reservedQuantity: 2n,
      availableQuantity: 5n,
    });
    expect(quantities.get(52)).toEqual({
      effectiveQuantity: 4n,
      reservedQuantity: 0n,
      availableQuantity: 4n,
    });
  });

  it('filters by instrument before validating unrelated order movements', () => {
    const quantities = calculator.calculate(
      [
        movement(47, OrderSide.Buy, OrderStatus.Filled, 3),
        movement(null, OrderSide.Buy, OrderStatus.Filled, null),
      ],
      47,
    );

    expect(quantities.get(47)?.availableQuantity).toBe(3n);
  });

  it.each([
    movement(47, OrderSide.Buy, OrderStatus.Filled, null),
    movement(null, OrderSide.Sell, OrderStatus.New, 1),
  ])('rejects inconsistent position movements', (order) => {
    expect(() => calculator.calculate([order])).toThrow(
      InvalidFinancialDataError,
    );
  });
});

function movement(
  instrumentId: number | null,
  side: string,
  status: string,
  size: number | null,
): PositionMovement {
  return { instrumentId, side, status, size };
}
