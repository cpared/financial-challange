import { InternalServerErrorException } from '@nestjs/common';
import { OrderSide, OrderStatus } from '../enums/order.enums.js';

export interface CashOrderMovement {
  readonly size: number | null;
  readonly price: number | string | null;
  readonly side: string | null;
  readonly status: string | null;
}

export interface CashBalance {
  readonly cashBalanceInCents: bigint;
  readonly reservedCashInCents: bigint;
  readonly availableCashInCents: bigint;
}

export function toCents(value: number | string): bigint {
  const text = typeof value === 'number' ? value.toString() : value;
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) {
    throw new RangeError(`Invalid monetary value: ${text}`);
  }
  const [, sign, whole, fraction = ''] = match;
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return sign === '-' ? -cents : cents;
}

export function fromCents(value: bigint): number {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  return Number(`${sign}${whole}.${fraction}`);
}

export function centsToDecimal(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  return `${sign}${whole}.${fraction}`;
}

export function calculateCashBalance(
  orders: readonly CashOrderMovement[],
): CashBalance {
  let cashBalanceInCents = 0n;
  let reservedCashInCents = 0n;

  for (const order of orders) {
    const size = BigInt(order.size ?? 0);
    if (order.side === 'CASH_IN' && order.status === OrderStatus.Filled) {
      cashBalanceInCents += size * 100n;
    } else if (
      order.side === 'CASH_OUT' &&
      order.status === OrderStatus.Filled
    ) {
      cashBalanceInCents -= size * 100n;
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

function requirePrice(price: number | string | null): number | string {
  if (price === null) {
    throw new InternalServerErrorException(
      'An existing trade order has no recorded price.',
    );
  }
  return price;
}
