import { OrderSide, OrderStatus } from '../../../common/enums/order.enums.js';
import { PortfolioOrderRepositoryDto } from '../repositories/dto/portfolio-repository-response.dto.js';
import { CashCalculator } from './cash-calculator.js';

describe('CashCalculator', () => {
  it('calculates the accounting and available cash balances', () => {
    const orders = [
      movement('CASH_IN', OrderStatus.Filled, 1_000),
      movement(OrderSide.Buy, OrderStatus.Filled, 2, '100.00'),
      movement(OrderSide.Buy, OrderStatus.New, 1, '50.00'),
      movement('CASH_OUT', OrderStatus.Filled, 100),
    ];

    expect(new CashCalculator().calculate(orders)).toEqual({
      cashBalanceInCents: 70_000n,
      reservedCashInCents: 5_000n,
      availableCashInCents: 65_000n,
    });
  });
});

function movement(
  side: string,
  status: string,
  size: number,
  price: string | null = null,
): PortfolioOrderRepositoryDto {
  return new PortfolioOrderRepositoryDto(
    1,
    null,
    size,
    price,
    side,
    status,
    new Date('2026-01-01T10:00:00.000Z'),
    null,
  );
}
