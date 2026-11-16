import { PortfolioRepositoryResponseDto } from '../../repositories/dto/portfolio-repository-response.dto.js';

export class PortfolioPositionServiceResponseDto {
  constructor(
    public readonly instrumentId: number,
    public readonly ticker: string | null,
    public readonly name: string | null,
    public readonly quantity: number,
    public readonly marketValueArs: number,
    public readonly dailyReturnPercent: number | null,
  ) {}
}

export class PortfolioServiceResponseDto {
  constructor(
    public readonly userId: number,
    public readonly totalAccountValueArs: number,
    public readonly availableCashArs: number,
    public readonly positions: PortfolioPositionServiceResponseDto[],
  ) {}

  static fromRepository(
    repositoryResponse: PortfolioRepositoryResponseDto,
    totalAccountValueArs: number,
    availableCashArs: number,
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
