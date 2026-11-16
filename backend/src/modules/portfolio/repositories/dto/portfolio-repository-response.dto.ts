export class PortfolioInstrumentRepositoryDto {
  constructor(
    public readonly id: number,
    public readonly ticker: string | null,
    public readonly name: string | null,
    public readonly type: string | null,
    public readonly close: string | null,
    public readonly previousClose: string | null,
  ) {}
}

export class PortfolioOrderRepositoryDto {
  constructor(
    public readonly id: number,
    public readonly instrumentId: number | null,
    public readonly size: number | null,
    public readonly price: string | null,
    public readonly side: string | null,
    public readonly status: string | null,
    public readonly datetime: Date | null,
    public readonly instrument: PortfolioInstrumentRepositoryDto | null,
  ) {}
}

export class PortfolioRepositoryResponseDto {
  constructor(
    public readonly userId: number,
    public readonly userExists: boolean,
    public readonly orders: PortfolioOrderRepositoryDto[],
  ) {}
}
