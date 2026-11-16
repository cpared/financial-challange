export class OrderRepositoryResponseDto {
  constructor(
    public readonly id: number,
    public readonly instrumentId: number | null,
    public readonly userId: number | null,
    public readonly size: number | null,
    public readonly price: string | null,
    public readonly type: string | null,
    public readonly side: string | null,
    public readonly status: string | null,
    public readonly datetime: Date | null,
  ) {}
}
