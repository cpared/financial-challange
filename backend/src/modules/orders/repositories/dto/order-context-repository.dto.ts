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
    public readonly orderMovements: OrderMovementRepositoryDto[],
  ) {}
}

export class OrderMovementRepositoryDto {
  constructor(
    public readonly instrumentId: number | null,
    public readonly size: number | null,
    public readonly price: string | null,
    public readonly side: string | null,
    public readonly status: string | null,
  ) {}
}
