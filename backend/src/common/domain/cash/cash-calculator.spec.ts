import { OrderSide, OrderStatus } from '../../enums/order.enums.js';
import { InvalidFinancialDataError } from '../financial-data-error.js';
import { CashCalculator } from './cash-calculator.js';
import type { CashMovement } from './cash.types.js';

describe('CashCalculator', () => {
  const calculator = new CashCalculator();

  it('calculates executed cash movements, trades, and pending BUY reservations', () => {
    const balance = calculator.calculate([
      movement('CASH_IN', OrderStatus.Filled, 1_000),
      movement('CASH_OUT', OrderStatus.Filled, 100),
      movement(OrderSide.Buy, OrderStatus.Filled, 2, '100.00'),
      movement(OrderSide.Sell, OrderStatus.Filled, 1, '120.00'),
      movement(OrderSide.Buy, OrderStatus.New, 1, '50.00'),
      movement(OrderSide.Buy, OrderStatus.Rejected, 10, '100.00'),
      movement(OrderSide.Sell, OrderStatus.Cancelled, 10, '100.00'),
    ]);

    expect(balance).toEqual({
      cashBalanceInCents: 82_000n,
      reservedCashInCents: 5_000n,
      availableCashInCents: 77_000n,
    });
  });

  it.each([
    movement(OrderSide.Buy, OrderStatus.Filled, null, '10.00'),
    movement(OrderSide.Buy, OrderStatus.Filled, 1, null),
    movement(OrderSide.Buy, OrderStatus.New, 1, '1.001'),
  ])('rejects inconsistent financial data', (order) => {
    expect(() => calculator.calculate([order])).toThrow(
      InvalidFinancialDataError,
    );
  });
});

function movement(
  side: string,
  status: string,
  size: number | null,
  price: string | null = null,
): CashMovement {
  return { side, status, size, price };
}
