import { OrderSide, OrderStatus } from '../enums/order.enums.js';
import { CashCalculator } from './cash/cash-calculator.js';
import { PositionQuantityCalculator } from './positions/position-quantity-calculator.js';
import type { CashMovement } from './cash/cash.types.js';
import type { PositionMovement } from './positions/position.types.js';

describe('shared financial calculators', () => {
  it('provides consistent available cash and shares for an order history', () => {
    const history = [
      {
        instrumentId: null,
        size: 1_000,
        price: null,
        side: 'CASH_IN',
        status: OrderStatus.Filled,
      },
      {
        instrumentId: 47,
        size: 5,
        price: '100.00',
        side: OrderSide.Buy,
        status: OrderStatus.Filled,
      },
      {
        instrumentId: 47,
        size: 2,
        price: '110.00',
        side: OrderSide.Sell,
        status: OrderStatus.Filled,
      },
      {
        instrumentId: 47,
        size: 1,
        price: '90.00',
        side: OrderSide.Buy,
        status: OrderStatus.New,
      },
      {
        instrumentId: 47,
        size: 1,
        price: '100.00',
        side: OrderSide.Sell,
        status: OrderStatus.New,
      },
    ];
    const cashMovements: CashMovement[] = history;
    const positionMovements: PositionMovement[] = history;

    const cash = new CashCalculator().calculate(cashMovements);
    const quantity = new PositionQuantityCalculator()
      .calculate(positionMovements)
      .get(47);

    expect(cash.availableCashInCents).toBe(63_000n);
    expect(quantity).toEqual({
      effectiveQuantity: 3n,
      reservedQuantity: 1n,
      availableQuantity: 2n,
    });
  });
});
