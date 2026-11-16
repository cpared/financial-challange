export class CreateOrderRepositoryInputDto {
  constructor(
    public readonly userId: number,
    public readonly instrumentId: number,
    public readonly size: number,
    public readonly price: number,
    public readonly type: string,
    public readonly side: string,
    public readonly status: string,
    public readonly datetime: Date,
  ) {}
}
