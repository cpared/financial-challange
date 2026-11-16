import { OrderRepositoryResponseDto } from '../../repositories/dto/order-repository-response.dto.js';

export class OrderServiceResponseDto {
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

  static map(order: OrderRepositoryResponseDto): OrderServiceResponseDto {
    return new OrderServiceResponseDto(
      order.id,
      order.instrumentId,
      order.userId,
      order.size,
      order.price,
      order.type,
      order.side,
      order.status,
      order.datetime,
    );
  }
}
