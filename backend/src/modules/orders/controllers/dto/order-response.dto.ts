import { OrderServiceResponseDto } from '../../services/dto/order-service-response.dto.js';

export class OrderResponseDto {
  constructor(
    public readonly id: number,
    public readonly instrumentId: number | null,
    public readonly userId: number | null,
    public readonly size: number | null,
    public readonly price: number | null,
    public readonly type: string | null,
    public readonly side: string | null,
    public readonly status: string | null,
    public readonly datetime: string | null,
  ) {}

  static map(order: OrderServiceResponseDto): OrderResponseDto {
    return new OrderResponseDto(
      order.id,
      order.instrumentId,
      order.userId,
      order.size,
      order.price === null ? null : Number(order.price),
      order.type,
      order.side,
      order.status,
      order.datetime?.toISOString() ?? null,
    );
  }
}
