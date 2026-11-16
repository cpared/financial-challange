import { OrderSide, OrderType } from '../../../../common/enums/order.enums.js';

export class CreateOrderServiceInputDto {
  constructor(
    public readonly userId: number,
    public readonly instrumentId: number,
    public readonly side: OrderSide,
    public readonly type: OrderType,
    public readonly quantity: number | undefined,
    public readonly amountArs: number | undefined,
    public readonly limitPrice: number | undefined,
  ) {}
}
