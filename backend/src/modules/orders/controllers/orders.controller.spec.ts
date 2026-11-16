import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import {
  OrderSide,
  OrderStatus,
  OrderType,
} from '../../../common/enums/order.enums.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from '../services/orders.service.js';
import { OrderServiceResponseDto } from '../services/dto/order-service-response.dto.js';

describe('OrdersController', () => {
  let controller: OrdersController;
  const service = {
    create: jest.fn<OrdersService['create']>(),
    cancel: jest.fn<OrdersService['cancel']>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: service }],
    }).compile();
    controller = module.get(OrdersController);
  });

  it('maps create requests and service results at the HTTP boundary', async () => {
    const datetime = new Date('2026-01-01T10:00:00.000Z');
    service.create.mockResolvedValue(
      new OrderServiceResponseDto(
        3,
        47,
        1,
        2,
        100,
        OrderType.Market,
        OrderSide.Buy,
        OrderStatus.Filled,
        datetime,
      ),
    );

    await expect(
      controller.create(1, {
        instrumentId: 47,
        side: OrderSide.Buy,
        type: OrderType.Market,
        quantity: 2,
        amountArs: undefined,
        price: undefined,
      }),
    ).resolves.toMatchObject({
      id: 3,
      size: 2,
      price: 100,
      status: OrderStatus.Filled,
      datetime: datetime.toISOString(),
    });
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        instrumentId: 47,
        quantity: 2,
        side: OrderSide.Buy,
        type: OrderType.Market,
      }),
    );
  });

  it('forwards cancellation and maps its result', async () => {
    service.cancel.mockResolvedValue(
      new OrderServiceResponseDto(
        3,
        47,
        1,
        2,
        100,
        OrderType.Limit,
        OrderSide.Buy,
        OrderStatus.Cancelled,
        new Date('2026-01-01T10:00:00.000Z'),
      ),
    );

    await expect(controller.cancel(1, 3)).resolves.toMatchObject({
      id: 3,
      status: OrderStatus.Cancelled,
    });
    expect(service.cancel).toHaveBeenCalledWith(1, 3);
  });
});
