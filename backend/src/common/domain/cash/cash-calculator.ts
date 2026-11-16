import { OrderSide, OrderStatus } from '../../enums/order.enums.js';
import { toCents } from '../../utils/money.js';
import {
  InvalidFinancialDataError,
  MissingTradePriceError,
  parseOrderSize,
} from '../financial-data-error.js';
import { CashBalance, CashMovement } from './cash.types.js';

export class CashCalculator {
  calculate(orders: readonly CashMovement[]): CashBalance {
    let cashBalanceInCents = 0n;
    let reservedCashInCents = 0n;

    for (const order of orders) {
      if (
        (order.side === 'CASH_IN' || order.side === 'CASH_OUT') &&
        order.status === OrderStatus.Filled
      ) {
        const size = parseOrderSize(order.size);
        cashBalanceInCents +=
          order.side === 'CASH_IN' ? size * 100n : -(size * 100n);
        continue;
      }

      const isFilledTrade =
        order.status === OrderStatus.Filled &&
        (order.side === OrderSide.Buy || order.side === OrderSide.Sell);
      const isPendingBuy =
        order.status === OrderStatus.New && order.side === OrderSide.Buy;
      if (!isFilledTrade && !isPendingBuy) {
        continue;
      }

      const size = parseOrderSize(order.size);
      const priceInCents = this.parsePositivePrice(order.price);
      const valueInCents = size * priceInCents;
      if (isPendingBuy) {
        reservedCashInCents += valueInCents;
      } else {
        cashBalanceInCents +=
          order.side === OrderSide.Buy ? -valueInCents : valueInCents;
      }
    }

    return {
      cashBalanceInCents,
      reservedCashInCents,
      availableCashInCents: cashBalanceInCents - reservedCashInCents,
    };
  }

  private parsePositivePrice(value: number | string | null): bigint {
    if (value === null) {
      throw new MissingTradePriceError();
    }
    let cents: bigint;
    try {
      cents = toCents(value);
    } catch (error) {
      if (error instanceof RangeError) {
        throw new InvalidFinancialDataError();
      }
      throw error;
    }
    if (cents <= 0n || cents > 9_999_999_999n) {
      throw new InvalidFinancialDataError();
    }
    return cents;
  }
}
