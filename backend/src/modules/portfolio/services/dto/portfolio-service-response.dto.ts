import { PortfolioRepositoryResponseDto } from '../../repositories/dto/portfolio-repository-response.dto.js';

export class PortfolioPositionServiceResponseDto {
  constructor(
    public readonly instrumentId: number,
    public readonly ticker: string | null,
    public readonly name: string | null,
    public readonly quantity: number,
    public readonly marketValueArs: string,
    public readonly totalReturnArs: string,
    public readonly totalReturnPercent: string | null,
    public readonly dailyReturnPercent: string,
  ) {}
}

export class PortfolioServiceResponseDto {
  constructor(
    public readonly userId: number,
    public readonly totalAccountValueArs: string,
    public readonly availableCashArs: string,
    public readonly positions: PortfolioPositionServiceResponseDto[],
  ) {}

  static fromRepository(
    repositoryResponse: PortfolioRepositoryResponseDto,
    totalAccountValueArs: string,
    availableCashArs: string,
    positions: PortfolioPositionServiceResponseDto[],
  ): PortfolioServiceResponseDto {
    return new PortfolioServiceResponseDto(
      repositoryResponse.userId,
      totalAccountValueArs,
      availableCashArs,
      positions,
    );
  }
}
