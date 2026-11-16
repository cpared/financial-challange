import { OrderSide, OrderStatus } from '../../enums/order.enums.js';
import {
  InvalidFinancialDataError,
  parseOrderSize,
} from '../financial-data-error.js';
import { PositionMovement, PositionQuantity } from './position.types.js';

export class PositionQuantityCalculator {
  calculate(
    orders: readonly PositionMovement[],
    instrumentId?: number,
  ): ReadonlyMap<number, PositionQuantity> {
    const quantities = new Map<number, PositionQuantity>();

    for (const order of orders) {
      if (instrumentId !== undefined && order.instrumentId !== instrumentId) {
        continue;
      }
      const isFilledTrade =
        order.status === OrderStatus.Filled &&
        (order.side === OrderSide.Buy || order.side === OrderSide.Sell);
      const isPendingSell =
        order.status === OrderStatus.New && order.side === OrderSide.Sell;
      if (!isFilledTrade && !isPendingSell) {
        continue;
      }

      if (
        order.instrumentId === null ||
        !Number.isInteger(order.instrumentId) ||
        order.instrumentId <= 0
      ) {
        throw new InvalidFinancialDataError();
      }
      const size = parseOrderSize(order.size);
      const existing = quantities.get(order.instrumentId) ?? {
        effectiveQuantity: 0n,
        reservedQuantity: 0n,
        availableQuantity: 0n,
      };

      const effectiveQuantity =
        isFilledTrade && order.side === OrderSide.Buy
          ? existing.effectiveQuantity + size
          : isFilledTrade
            ? existing.effectiveQuantity - size
            : existing.effectiveQuantity;
      const reservedQuantity = isPendingSell
        ? existing.reservedQuantity + size
        : existing.reservedQuantity;
      quantities.set(order.instrumentId, {
        effectiveQuantity,
        reservedQuantity,
        availableQuantity: effectiveQuantity - reservedQuantity,
      });
    }

    return quantities;
  }
}
