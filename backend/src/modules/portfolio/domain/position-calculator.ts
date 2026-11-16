import { Inject, Injectable } from '@nestjs/common';
import {
  calculateTotalPositionReturn,
  formatPercent,
  formatRationalCents,
} from './cost-basis/weighted-average.strategy.js';
import type {
  CostBasisStrategy,
  FilledTrade,
  PositionCostBasis,
} from './cost-basis/cost-basis.strategy.js';
import { COST_BASIS_STRATEGY } from './cost-basis/cost-basis.strategy.js';
import { ValidatedOpenPosition } from './portfolio-validator.js';

export interface CalculatedPosition {
  readonly instrumentId: number;
  readonly ticker: string | null;
  readonly name: string | null;
  readonly quantity: number;
  readonly marketValueInCents: bigint;
  readonly totalReturnArs: string;
  readonly totalReturnPercent: string | null;
  readonly dailyReturnPercent: string;
}

@Injectable()
export class PositionCalculator {
  constructor(
    @Inject(COST_BASIS_STRATEGY)
    private readonly costBasisStrategy: CostBasisStrategy,
  ) {}

  calculateCostBases(
    trades: readonly FilledTrade[],
  ): ReadonlyMap<number, PositionCostBasis> {
    return this.costBasisStrategy.calculate(trades);
  }

  valuePositions(
    positions: readonly ValidatedOpenPosition[],
  ): CalculatedPosition[] {
    return positions.map((position) => {
      const marketValueInCents =
        position.costBasis.quantity * position.closeInCents;
      const totalReturn = calculateTotalPositionReturn(
        marketValueInCents,
        position.costBasis.acquisitionCostInCents,
      );
      return {
        instrumentId: position.instrumentId,
        ticker: position.instrument.ticker,
        name: position.instrument.name,
        quantity: Number(position.costBasis.quantity),
        marketValueInCents,
        totalReturnArs: formatRationalCents(totalReturn.profitInCents),
        totalReturnPercent: totalReturn.returnPercent,
        dailyReturnPercent: formatPercent(
          position.closeInCents - position.previousCloseInCents,
          position.previousCloseInCents,
        ),
      };
    });
  }

  totalMarketValueInCents(positions: readonly CalculatedPosition[]): bigint {
    return positions.reduce(
      (total, position) => total + position.marketValueInCents,
      0n,
    );
  }

  toCalculationValues(positions: readonly CalculatedPosition[]) {
    return positions.map((position) => ({
      instrumentId: position.instrumentId,
      ticker: position.ticker,
      name: position.name,
      quantity: position.quantity,
      marketValueArs: position.marketValueInCents,
      totalReturnArs: position.totalReturnArs,
      totalReturnPercent: position.totalReturnPercent,
      dailyReturnPercent: position.dailyReturnPercent,
    }));
  }
}
