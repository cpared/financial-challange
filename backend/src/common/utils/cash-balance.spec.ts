import { InternalServerErrorException } from '@nestjs/common';
import { OrderSide, OrderStatus } from '../enums/order.enums.js';
import {
  calculateCashBalance,
  centsToDecimal,
  fromCents,
  toCents,
} from './cash-balance.js';

describe('cash-balance utilities', () => {
  it('converts decimal ARS to integer cents without floating point arithmetic', () => {
    expect(toCents(0.29)).toBe(29n);
    expect(toCents('99999999.99')).toBe(9_999_999_999n);
    expect(centsToDecimal(9_999_999_999n)).toBe('99999999.99');
    expect(fromCents(-29n)).toBe(-0.29);
  });

  it('rejects monetary values with unsupported precision or notation', () => {
    expect(() => toCents(1.001)).toThrow(RangeError);
    expect(() => toCents(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('calculates filled cash movements separately from NEW reservations', () => {
    const balance = calculateCashBalance([
      {
        size: 2_147_483_647,
        price: 1,
        side: 'CASH_IN',
        status: OrderStatus.Filled,
      },
      {
        size: 1,
        price: 0.1,
        side: OrderSide.Buy,
        status: OrderStatus.Filled,
      },
      {
        size: 2,
        price: 0.29,
        side: OrderSide.Buy,
        status: OrderStatus.New,
      },
      {
        size: 2,
        price: 0.29,
        side: OrderSide.Sell,
        status: OrderStatus.Cancelled,
      },
    ]);

    expect(balance.cashBalanceInCents).toBe(214_748_364_690n);
    expect(balance.reservedCashInCents).toBe(58n);
    expect(balance.availableCashInCents).toBe(214_748_364_632n);
  });

  it('surfaces malformed filled trade records instead of treating them as zero', () => {
    expect(() =>
      calculateCashBalance([
        {
          size: 1,
          price: null,
          side: OrderSide.Buy,
          status: OrderStatus.Filled,
        },
      ]),
    ).toThrow(InternalServerErrorException);
  });
});
