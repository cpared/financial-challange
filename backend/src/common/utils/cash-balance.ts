import { InternalServerErrorException } from '@nestjs/common';
import { OrderSide, OrderStatus } from '../enums/order.enums.js';

export interface CashOrderMovement {
  readonly size: number | null;
  readonly price: number | null;
  readonly side: string | null;
  readonly status: string | null;
}

export interface CashBalance {
  readonly cashBalanceInCents: number;
  readonly reservedCashInCents: number;
  readonly availableCashInCents: number;
}

export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function fromCents(value: number): number {
  return Number((value / 100).toFixed(2));
}

export function calculateCashBalance(
  orders: readonly CashOrderMovement[],
): CashBalance {
  let cashBalanceInCents = 0;
  let reservedCashInCents = 0;

  for (const order of orders) {
    const size = order.size ?? 0;
    if (order.side === 'CASH_IN' && order.status === OrderStatus.Filled) {
      cashBalanceInCents += size * 100;
    } else if (
      order.side === 'CASH_OUT' &&
      order.status === OrderStatus.Filled
    ) {
      cashBalanceInCents -= size * 100;
    } else if (
      order.status === OrderStatus.Filled &&
      (order.side === OrderSide.Buy || order.side === OrderSide.Sell)
    ) {
      const valueInCents = size * toCents(requirePrice(order.price));
      cashBalanceInCents +=
        order.side === OrderSide.Buy ? -valueInCents : valueInCents;
    } else if (
      order.side === OrderSide.Buy &&
      order.status === OrderStatus.New
    ) {
      reservedCashInCents += size * toCents(requirePrice(order.price));
    }
  }

  return {
    cashBalanceInCents,
    reservedCashInCents,
    availableCashInCents: cashBalanceInCents - reservedCashInCents,
  };
}

function requirePrice(price: number | null): number {
  if (price === null) {
    throw new InternalServerErrorException(
      'An existing trade order has no recorded price.',
    );
  }
  return price;
}
