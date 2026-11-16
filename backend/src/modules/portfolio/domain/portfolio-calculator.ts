import { Injectable } from '@nestjs/common';
import { centsToDecimal } from '../../../common/utils/cash-balance.js';
import { PortfolioRepositoryResponseDto } from '../repositories/dto/portfolio-repository-response.dto.js';
import { CashCalculator } from './cash-calculator.js';
import { PortfolioCalculationResult } from './portfolio-calculation-result.js';
import { PortfolioDataIntegrityError } from './portfolio-errors.js';
import { PortfolioValidator } from './portfolio-validator.js';
import { PositionCalculator } from './position-calculator.js';

@Injectable()
export class PortfolioCalculator {
  constructor(
    private readonly validator: PortfolioValidator,
    private readonly cashCalculator: CashCalculator,
    private readonly positionCalculator: PositionCalculator,
  ) {}

  calculate(
    portfolio: PortfolioRepositoryResponseDto,
  ): PortfolioCalculationResult {
    const validatedData = this.validator.validateOrders(portfolio.orders);
    const cashBalance = this.cashCalculator.calculate(portfolio.orders);

    let costBases;
    try {
      costBases = this.positionCalculator.calculateCostBases(
        validatedData.trades,
      );
    } catch (error) {
      if (error instanceof RangeError) {
        throw new PortfolioDataIntegrityError();
      }
      throw error;
    }

    const openPositions = this.validator.validateOpenPositions(
      costBases,
      validatedData.instruments,
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
