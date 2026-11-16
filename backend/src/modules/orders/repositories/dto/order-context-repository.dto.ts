export class InstrumentOrderContextRepositoryDto {
  constructor(
    public readonly id: number,
    public readonly name: string | null,
    public readonly type: string | null,
    public readonly close: string | null,
  ) {}
}

export class OrderContextRepositoryDto {
  constructor(
    public readonly instrument: InstrumentOrderContextRepositoryDto | null,
    public readonly cashBalanceInCents: string,
    public readonly reservedCashInCents: string,
    public readonly effectiveQuantity: string,
    public readonly reservedQuantity: string,
    public readonly hasMissingTradePrice: boolean,
  ) {}
}
