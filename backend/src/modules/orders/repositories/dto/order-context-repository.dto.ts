export class InstrumentOrderContextRepositoryDto {
  constructor(
    public readonly id: number,
    public readonly name: string | null,
    public readonly type: string | null,
    public readonly close: number | null,
  ) {}
}

export class AccountOrderRepositoryDto {
  constructor(
    public readonly instrumentId: number | null,
    public readonly size: number | null,
    public readonly price: number | null,
    public readonly side: string | null,
    public readonly status: string | null,
  ) {}
}

export class OrderContextRepositoryDto {
  constructor(
    public readonly userExists: boolean,
    public readonly instrument: InstrumentOrderContextRepositoryDto | null,
    public readonly orders: AccountOrderRepositoryDto[],
  ) {}
}
