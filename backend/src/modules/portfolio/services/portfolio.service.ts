import {
  InternalServerErrorException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PortfolioRepository } from '../repositories/portfolio.repository.js';
import { PortfolioCalculator } from '../domain/portfolio-calculator.js';
import {
  PortfolioDataIntegrityError,
  PortfolioMarketDataUnavailableError,
} from '../domain/portfolio-errors.js';
import { TelemetryService } from '../../../common/observability/telemetry.service.js';
import {
  PortfolioPositionServiceResponseDto,
  PortfolioServiceResponseDto,
} from './dto/portfolio-service-response.dto.js';

@Injectable()
export class PortfolioService {
  constructor(
    private readonly portfolioRepository: PortfolioRepository,
    private readonly portfolioCalculator: PortfolioCalculator,
    private readonly telemetry: TelemetryService,
  ) {}

  async getPortfolio(userId: number): Promise<PortfolioServiceResponseDto> {
    return this.telemetry.runInSpan(
      'portfolio.get',
      { 'app.layer': 'service' },
      () => this.calculatePortfolio(userId),
    );
  }

  private async calculatePortfolio(
    userId: number,
  ): Promise<PortfolioServiceResponseDto> {
    const repositoryResponse =
      await this.portfolioRepository.findByUserId(userId);
    if (!repositoryResponse.userExists) {
      throw new NotFoundException(`User ${userId} was not found.`);
    }

    try {
      const calculation =
        this.portfolioCalculator.calculate(repositoryResponse);
      return new PortfolioServiceResponseDto(
        calculation.userId,
        calculation.totalAccountValueArs,
        calculation.availableCashArs,
        calculation.positions
          .map(
            (position) =>
              new PortfolioPositionServiceResponseDto(
                position.instrumentId,
                position.ticker,
                position.name,
                position.quantity,
                position.marketValueArs,
                position.totalReturnArs,
                position.totalReturnPercent,
                position.dailyReturnPercent,
              ),
          )
          .sort((left, right) =>
            (left.ticker ?? '').localeCompare(right.ticker ?? ''),
          ),
      );
    } catch (error) {
      if (error instanceof PortfolioDataIntegrityError) {
        throw new InternalServerErrorException(
          'Portfolio data is inconsistent and cannot be calculated.',
        );
      }
      if (error instanceof PortfolioMarketDataUnavailableError) {
        throw new ServiceUnavailableException(
          'Market data is currently unavailable for one or more positions.',
        );
      }
      throw error;
    }
  }
}
