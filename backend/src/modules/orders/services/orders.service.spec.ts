import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { CashCalculator } from '../../../common/domain/cash/cash-calculator.js';
import { PositionQuantityCalculator } from '../../../common/domain/positions/position-quantity-calculator.js';
import { TelemetryService } from '../../../common/observability/telemetry.service.js';
import {
  OrderSide,
  OrderStatus,
  OrderType,
} from '../../../common/enums/order.enums.js';
import { CreateOrderRepositoryInputDto } from '../repositories/dto/create-order-repository-input.dto.js';
import {
  InstrumentOrderContextRepositoryDto,
  OrderMovementRepositoryDto,
  OrderContextRepositoryDto,
} from '../repositories/dto/order-context-repository.dto.js';
import { OrderRepositoryResponseDto } from '../repositories/dto/order-repository-response.dto.js';
import { OrdersRepository } from '../repositories/orders.repository.js';
import { CreateOrderServiceInputDto } from './dto/create-order-service-input.dto.js';
import { OrdersService } from './orders.service.js';

describe('OrdersService', () => {
  let service: OrdersService;
  const repository = {
    acquireAccountLock: jest.fn<OrdersRepository['acquireAccountLock']>(),
    getOrderContext: jest.fn<OrdersRepository['getOrderContext']>(),
    create: jest.fn<OrdersRepository['create']>(),
    findForCancellation: jest.fn<OrdersRepository['findForCancellation']>(),
    cancel: jest.fn<OrdersRepository['cancel']>(),
  };
  const transactionClient = new PrismaClient();
  const prisma = {
    $transaction: jest.fn(
      <T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) =>
        operation(transactionClient),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: OrdersRepository, useValue: repository },
        { provide: PrismaService, useValue: prisma },
        CashCalculator,
        PositionQuantityCalculator,
        TelemetryService,
      ],
    }).compile();
    service = module.get(OrdersService);
    repository.acquireAccountLock.mockResolvedValue(true);
    repository.create.mockImplementation(
      async (input: CreateOrderRepositoryInputDto) =>
        new OrderRepositoryResponseDto(
          9,
          input.instrumentId,
          input.userId,
          input.size,
          input.price,
          input.type,
          input.side,
          input.status,
          input.datetime,
        ),
    );
  });

  function context(
    close: string | null,
    orderMovements: OrderMovementRepositoryDto[] = [],
  ): OrderContextRepositoryDto {
    return new OrderContextRepositoryDto(
      new InstrumentOrderContextRepositoryDto(47, 'Banco', 'ACCIONES', close),
      orderMovements,
    );
  }

  function movement(
    instrumentId: number | null,
    size: number | null,
    price: string | null,
    side: string,
    status: string,
  ): OrderMovementRepositoryDto {
    return new OrderMovementRepositoryDto(
      instrumentId,
      size,
      price,
      side,
      status,
    );
  }

  afterAll(async () => {
    await transactionClient.$disconnect();
  });

  it('executes MARKET orders at the current close and marks them FILLED', async () => {
    repository.getOrderContext.mockResolvedValue(
      context('100.00', [movement(null, 1000, null, 'CASH_IN', 'FILLED')]),
    );

    const result = await service.create(
      new CreateOrderServiceInputDto(
        1,
        47,
        OrderSide.Buy,
        OrderType.Market,
        2,
        undefined,
        1,
      ),
    );

    expect(result).toMatchObject({
      size: 2,
      price: '100.00',
      status: 'FILLED',
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        size: 2,
        price: '100.00',
        status: OrderStatus.Filled,
      }),
      transactionClient,
    );
  });

  it('converts an amount into the maximum whole shares', async () => {
    repository.getOrderContext.mockResolvedValue(
      context('100.00', [movement(null, 1000, null, 'CASH_IN', 'FILLED')]),
    );

    await service.create(
      new CreateOrderServiceInputDto(
        1,
        47,
        OrderSide.Buy,
        OrderType.Market,
        undefined,
        250,
        undefined,
      ),
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ size: 2, price: '100.00' }),
      transactionClient,
    );
  });

  it('persists an unaffordable order as REJECTED', async () => {
    repository.getOrderContext.mockResolvedValue(context('100.00'));

    const result = await service.create(
      new CreateOrderServiceInputDto(
        1,
        47,
        OrderSide.Buy,
        OrderType.Market,
        1,
        undefined,
        undefined,
      ),
    );

    expect(result.status).toBe(OrderStatus.Rejected);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: OrderStatus.Rejected }),
      transactionClient,
    );
  });

  it('accounts for cash reserved by existing NEW buy orders', async () => {
    repository.getOrderContext.mockResolvedValue(
      context('100.00', [
        movement(null, 1000, null, 'CASH_IN', 'FILLED'),
        movement(null, 7, '100.00', OrderSide.Buy, OrderStatus.New),
      ]),
    );

    const result = await service.create(
      new CreateOrderServiceInputDto(
        1,
        47,
        OrderSide.Buy,
        OrderType.Market,
        4,
        undefined,
        undefined,
      ),
    );

    expect(result.status).toBe(OrderStatus.Rejected);
  });

  it('surfaces inconsistent existing FILLED movements as an internal error', async () => {
    repository.getOrderContext.mockResolvedValue(
      context('100.00', [
        movement(47, null, '100.00', OrderSide.Buy, OrderStatus.Filled),
      ]),
    );

    await expect(
      service.create(
        new CreateOrderServiceInputDto(
          1,
          47,
          OrderSide.Buy,
          OrderType.Market,
          1,
          undefined,
          undefined,
        ),
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('preserves the existing missing execution-price error response', async () => {
    repository.getOrderContext.mockResolvedValue(
      context('100.00', [
        movement(47, 1, null, OrderSide.Buy, OrderStatus.Filled),
      ]),
    );

    await expect(
      service.create(
        new CreateOrderServiceInputDto(
          1,
          47,
          OrderSide.Buy,
          OrderType.Market,
          1,
          undefined,
          undefined,
        ),
      ),
    ).rejects.toMatchObject({
      message: 'An existing trade order has no recorded price.',
    });
  });

  it('does not sell shares already reserved by a NEW sell order', async () => {
    repository.getOrderContext.mockResolvedValue(
      context('100.00', [
        movement(47, 3, '100.00', OrderSide.Buy, OrderStatus.Filled),
        movement(47, 2, '100.00', OrderSide.Sell, OrderStatus.New),
      ]),
    );

    const result = await service.create(
      new CreateOrderServiceInputDto(
        1,
        47,
        OrderSide.Sell,
        OrderType.Market,
        2,
        undefined,
        undefined,
      ),
    );

    expect(result.status).toBe(OrderStatus.Rejected);
  });

  it('rejects cancellation for an order that is not NEW', async () => {
    repository.findForCancellation.mockResolvedValue(
      new OrderRepositoryResponseDto(
        1,
        47,
        1,
        1,
        '100.00',
        'MARKET',
        'BUY',
        OrderStatus.Filled,
        new Date(),
      ),
    );

    await expect(service.cancel(1, 1)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(repository.cancel).not.toHaveBeenCalled();
  });

  it('accepts a LIMIT order without market data and uses only its limit price', async () => {
    repository.getOrderContext.mockResolvedValue(
      context(null, [movement(null, 1000, null, 'CASH_IN', 'FILLED')]),
    );

    const result = await service.create(
      new CreateOrderServiceInputDto(
        1,
        47,
        OrderSide.Buy,
        OrderType.Limit,
        1,
        undefined,
        80,
      ),
    );

    expect(result).toMatchObject({
      price: '80.00',
      status: OrderStatus.New,
    });
  });

  it('rejects an invalid side instead of treating it as SELL', async () => {
    await expect(
      service.create(
        new CreateOrderServiceInputDto(
          1,
          47,
          'INVALID' as OrderSide,
          OrderType.Market,
          1,
          undefined,
          undefined,
        ),
      ),
    ).rejects.toThrow('side must be BUY or SELL.');
    expect(repository.acquireAccountLock).not.toHaveBeenCalled();
  });

  it('rejects an amount whose computed size exceeds the database INT limit', async () => {
    repository.getOrderContext.mockResolvedValue(context('0.01'));

    await expect(
      service.create(
        new CreateOrderServiceInputDto(
          1,
          47,
          OrderSide.Buy,
          OrderType.Limit,
          undefined,
          99_999_999.99,
          0.01,
        ),
      ),
    ).rejects.toThrow('maximum supported share quantity');
  });

  it('calculates maximum whole shares without floating-point cent loss', async () => {
    repository.getOrderContext.mockResolvedValue(
      context('0.10', [movement(null, 1, null, 'CASH_IN', 'FILLED')]),
    );

    const result = await service.create(
      new CreateOrderServiceInputDto(
        1,
        47,
        OrderSide.Buy,
        OrderType.Market,
        undefined,
        0.29,
        undefined,
      ),
    );

    expect(result.size).toBe(2);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ size: 2, price: '0.10' }),
      transactionClient,
    );
  });
});
