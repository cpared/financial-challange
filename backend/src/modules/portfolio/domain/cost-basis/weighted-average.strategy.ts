import { Injectable } from '@nestjs/common';
import { OrderSide } from '../../../../common/enums/order.enums.js';
import type {
  CostBasisStrategy,
  FilledTrade,
  PositionCostBasis,
  RationalAmount,
  TotalPositionReturn,
} from './cost-basis.strategy.js';

@Injectable()
export class WeightedAverageStrategy implements CostBasisStrategy {
  calculate(
    trades: readonly FilledTrade[],
  ): ReadonlyMap<number, PositionCostBasis> {
    return calculateWeightedAverageCostBasis(trades);
  }
}

export function calculateWeightedAverageCostBasis(
  trades: readonly FilledTrade[],
): ReadonlyMap<number, PositionCostBasis> {
  const positions = new Map<number, PositionCostBasis>();

  for (const trade of trades) {
    const position = positions.get(trade.instrumentId) ?? {
      quantity: 0n,
      acquisitionCostInCents: rational(0n, 1n),
      unitCostInCents: null,
    };

    if (trade.side === OrderSide.Buy) {
      const quantity = position.quantity + trade.quantity;
      const acquisitionCostInCents = add(
        position.acquisitionCostInCents,
        rational(trade.quantity * trade.priceInCents, 1n),
      );
      positions.set(trade.instrumentId, {
        quantity,
        acquisitionCostInCents,
        unitCostInCents: rational(
          acquisitionCostInCents.numerator,
          acquisitionCostInCents.denominator * quantity,
        ),
      });
      continue;
    }

    if (trade.quantity > position.quantity) {
      throw new RangeError('Filled sale exceeds the available position.');
    }
    const remainingQuantity = position.quantity - trade.quantity;
    const acquisitionCostInCents =
      remainingQuantity === 0n
        ? rational(0n, 1n)
        : multiplyRatio(
            position.acquisitionCostInCents,
            remainingQuantity,
            position.quantity,
          );
    positions.set(trade.instrumentId, {
      quantity: remainingQuantity,
      acquisitionCostInCents,
      unitCostInCents:
        remainingQuantity === 0n
          ? null
          : rational(
              acquisitionCostInCents.numerator,
              acquisitionCostInCents.denominator * remainingQuantity,
            ),
    });
  }

  return positions;
}

export function formatRationalCents(value: RationalAmount): string {
  return formatCents(roundDivide(value.numerator, value.denominator));
}

export function calculateTotalPositionReturn(
  marketValueInCents: bigint,
  acquisitionCostInCents: RationalAmount,
): TotalPositionReturn {
  const profitInCents = subtract(
    rational(marketValueInCents, 1n),
    acquisitionCostInCents,
  );
  return {
    profitInCents,
    returnPercent:
      acquisitionCostInCents.numerator === 0n
        ? null
        : formatPercent(
            profitInCents.numerator * acquisitionCostInCents.denominator,
            profitInCents.denominator * acquisitionCostInCents.numerator,
          ),
  };
}

export function formatPercent(numerator: bigint, denominator: bigint): string {
  if (denominator <= 0n) {
    throw new RangeError('Percentage denominator must be positive.');
  }
  const hundredthsPercent = roundDivide(numerator * 10_000n, denominator);
  const sign = hundredthsPercent < 0n ? '-' : '';
  const absolute =
    hundredthsPercent < 0n ? -hundredthsPercent : hundredthsPercent;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  return `${sign}${whole}.${fraction}`;
}

export function subtract(
  left: RationalAmount,
  right: RationalAmount,
): RationalAmount {
  return rational(
    left.numerator * right.denominator - right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

export function rational(
  numerator: bigint,
  denominator: bigint,
): RationalAmount {
  if (denominator === 0n) {
    throw new RangeError('Rational denominator must not be zero.');
  }
  const sign = denominator < 0n ? -1n : 1n;
  const signedNumerator = numerator * sign;
  const positiveDenominator = denominator * sign;
  const divisor = greatestCommonDivisor(
    signedNumerator < 0n ? -signedNumerator : signedNumerator,
    positiveDenominator,
  );
  return {
    numerator: signedNumerator / divisor,
    denominator: positiveDenominator / divisor,
  };
}

function add(left: RationalAmount, right: RationalAmount): RationalAmount {
  return rational(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function multiplyRatio(
  value: RationalAmount,
  numerator: bigint,
  denominator: bigint,
): RationalAmount {
  return rational(value.numerator * numerator, value.denominator * denominator);
}

function roundDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new RangeError('Division denominator must be positive.');
  }
  const sign = numerator < 0n ? -1n : 1n;
  const absolute = numerator < 0n ? -numerator : numerator;
  const quotient = absolute / denominator;
  const remainder = absolute % denominator;
  return sign * (quotient + (remainder * 2n >= denominator ? 1n : 0n));
}

function formatCents(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  return `${sign}${whole}.${fraction}`;
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;
  while (b !== 0n) {
    [a, b] = [b, a % b];
  }
  return a === 0n ? 1n : a;
}
