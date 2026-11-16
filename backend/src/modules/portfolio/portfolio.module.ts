import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { PortfolioController } from './controllers/portfolio.controller.js';
import { PortfolioRepository } from './repositories/portfolio.repository.js';
import { CashCalculator } from '../../common/domain/cash/cash-calculator.js';
import { PositionQuantityCalculator } from '../../common/domain/positions/position-quantity-calculator.js';
import { COST_BASIS_STRATEGY } from './domain/cost-basis/cost-basis.strategy.js';
import { WeightedAverageStrategy } from './domain/cost-basis/weighted-average.strategy.js';
import { PortfolioCalculator } from './domain/portfolio-calculator.js';
import { PortfolioValidator } from './domain/portfolio-validator.js';
import { PositionCalculator } from './domain/position-calculator.js';
import { PortfolioService } from './services/portfolio.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [PortfolioController],
  providers: [
    PortfolioRepository,
    PortfolioService,
    PortfolioValidator,
    CashCalculator,
    PositionQuantityCalculator,
    PositionCalculator,
    PortfolioCalculator,
    WeightedAverageStrategy,
    {
      provide: COST_BASIS_STRATEGY,
      useExisting: WeightedAverageStrategy,
    },
  ],
})
export class PortfolioModule {}
