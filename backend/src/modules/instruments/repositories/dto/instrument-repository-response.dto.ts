export class InstrumentRepositoryResponseDto {
  constructor(
    public readonly id: number,
    public readonly ticker: string | null,
    public readonly name: string | null,
    public readonly type: string | null,
  ) {}
}
