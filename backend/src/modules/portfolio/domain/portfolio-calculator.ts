import { Injectable } from '@nestjs/common';
import { CashCalculator } from '../../../common/domain/cash/cash-calculator.js';
import { PositionQuantityCalculator } from '../../../common/domain/positions/position-quantity-calculator.js';
import { InvalidFinancialDataError } from '../../../common/domain/financial-data-error.js';
import type { CashBalance } from '../../../common/domain/cash/cash.types.js';
import type { PositionQuantity } from '../../../common/domain/positions/position.types.js';
import { centsToDecimal } from '../../../common/utils/money.js';
import { PortfolioRepositoryResponseDto } from '../repositories/dto/portfolio-repository-response.dto.js';
import { PortfolioCalculationResult } from './portfolio-calculation-result.js';
import { PortfolioDataIntegrityError } from './portfolio-errors.js';
import { PortfolioValidator } from './portfolio-validator.js';
import type { ValidatedPortfolioData } from './portfolio-validator.js';
import { PositionCalculator } from './position-calculator.js';
import type { PositionCostBasis } from './cost-basis/cost-basis.strategy.js';

@Injectable()
export class PortfolioCalculator {
  constructor(
    private readonly validator: PortfolioValidator,
    private readonly cashCalculator: CashCalculator,
    private readonly positionQuantityCalculator: PositionQuantityCalculator,
    private readonly positionCalculator: PositionCalculator,
  ) {}

  calculate(
    portfolio: PortfolioRepositoryResponseDto,
  ): PortfolioCalculationResult {
    let validatedData: ValidatedPortfolioData;
    let cashBalance: CashBalance;
    let positionQuantities: ReadonlyMap<number, PositionQuantity>;
    let costBases: ReadonlyMap<number, PositionCostBasis>;
    try {
      validatedData = this.validator.validateOrders(portfolio.orders);
      cashBalance = this.cashCalculator.calculate(portfolio.orders);
      positionQuantities = this.positionQuantityCalculator.calculate(
        portfolio.orders,
      );
      costBases = this.positionCalculator.calculateCostBases(
        validatedData.trades,
      );
    } catch (error) {
      if (
        error instanceof InvalidFinancialDataError ||
        error instanceof RangeError
      ) {
        throw new PortfolioDataIntegrityError();
      }
      throw error;
    }

    const openPositions = this.validator.validateOpenPositions(
      costBases,
      validatedData.instruments,
      positionQuantities,
    );
    const valuedPositions =
      this.positionCalculator.valuePositions(openPositions);
    const marketValueInCents =
      this.positionCalculator.totalMarketValueInCents(valuedPositions);
    const totalAccountValueInCents =
      cashBalance.cashBalanceInCents + marketValueInCents;
    this.validator.validatePortfolioValue(totalAccountValueInCents);
    this.validator.validatePortfolioValue(cashBalance.availableCashInCents);

    return {
      userId: portfolio.userId,
      totalAccountValueArs: centsToDecimal(totalAccountValueInCents),
      availableCashArs: centsToDecimal(cashBalance.availableCashInCents),
      positions: this.positionCalculator
        .toCalculationValues(valuedPositions)
        .map((position) => ({
          ...position,
          marketValueArs: centsToDecimal(position.marketValueArs),
        }))
        .sort((left, right) =>
          (left.ticker ?? '').localeCompare(right.ticker ?? ''),
        ),
    };
  }
}
