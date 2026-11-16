import { OrderSide } from '../../../../common/enums/order.enums.js';

export interface FilledTrade {
  readonly instrumentId: number;
  readonly orderId: number;
  readonly datetime: Date;
  readonly side: OrderSide.Buy | OrderSide.Sell;
  readonly quantity: bigint;
  readonly priceInCents: bigint;
}

export interface RationalAmount {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export interface PositionCostBasis {
  readonly quantity: bigint;
  readonly acquisitionCostInCents: RationalAmount;
  readonly unitCostInCents: RationalAmount | null;
}

export interface TotalPositionReturn {
  readonly profitInCents: RationalAmount;
  readonly returnPercent: string | null;
}

export interface CostBasisStrategy {
  calculate(
    trades: readonly FilledTrade[],
  ): ReadonlyMap<number, PositionCostBasis>;
}

export const COST_BASIS_STRATEGY = Symbol('COST_BASIS_STRATEGY');
