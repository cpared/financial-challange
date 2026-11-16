import { PortfolioServiceResponseDto } from '../../services/dto/portfolio-service-response.dto.js';

export class PortfolioPositionResponseDto {
  constructor(
    public readonly instrumentId: number,
    public readonly ticker: string | null,
    public readonly name: string | null,
    public readonly quantity: number,
    public readonly marketValueArs: number,
    public readonly totalReturnArs: number,
    public readonly totalReturnPercent: number | null,
    public readonly dailyReturnPercent: number | null,
  ) {}

  static map(
    position: PortfolioServiceResponseDto['positions'][number],
  ): PortfolioPositionResponseDto {
    return new PortfolioPositionResponseDto(
      position.instrumentId,
      position.ticker,
      position.name,
      position.quantity,
      Number(position.marketValueArs),
      Number(position.totalReturnArs),
      position.totalReturnPercent === null
        ? null
        : Number(position.totalReturnPercent),
      Number(position.dailyReturnPercent),
    );
  }
}

export class PortfolioResponseDto {
  constructor(
    public readonly userId: number,
    public readonly totalAccountValueArs: number,
    public readonly availableCashArs: number,
    public readonly positions: PortfolioPositionResponseDto[],
  ) {}

  static map(portfolio: PortfolioServiceResponseDto): PortfolioResponseDto {
    return new PortfolioResponseDto(
      portfolio.userId,
      Number(portfolio.totalAccountValueArs),
      Number(portfolio.availableCashArs),
      portfolio.positions.map((position) =>
        PortfolioPositionResponseDto.map(position),
      ),
    );
  }
}
