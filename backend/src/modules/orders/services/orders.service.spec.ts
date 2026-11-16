import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  OrderSide,
  OrderStatus,
  OrderType,
} from '../../../common/enums/order.enums.js';
import { CreateOrderRepositoryInputDto } from '../repositories/dto/create-order-repository-input.dto.js';
import {
  AccountOrderRepositoryDto,
  InstrumentOrderContextRepositoryDto,
  OrderContextRepositoryDto,
} from '../repositories/dto/order-context-repository.dto.js';
import { OrderRepositoryResponseDto } from '../repositories/dto/order-repository-response.dto.js';
import { OrdersRepository } from '../repositories/orders.repository.js';
import { CreateOrderServiceInputDto } from './dto/create-order-service-input.dto.js';
import { OrdersService } from './orders.service.js';

describe('OrdersService', () => {
  let service: OrdersService;
  const repository = {
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
      ],
    }).compile();
    service = module.get(OrdersService);
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

  afterAll(async () => {
    await transactionClient.$disconnect();
  });

  it('executes MARKET orders at the current close and marks them FILLED', async () => {
    repository.getOrderContext.mockResolvedValue(
      new OrderContextRepositoryDto(
        true,
        new InstrumentOrderContextRepositoryDto(47, 'Banco', 'ACCIONES', 100),
        [new AccountOrderRepositoryDto(66, 1000, 1, 'CASH_IN', 'FILLED')],
      ),
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

    expect(result).toMatchObject({ size: 2, price: 100, status: 'FILLED' });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        size: 2,
        price: 100,
        status: OrderStatus.Filled,
      }),
      transactionClient,
    );
  });

  it('converts an amount into the maximum whole shares', async () => {
    repository.getOrderContext.mockResolvedValue(
      new OrderContextRepositoryDto(
        true,
        new InstrumentOrderContextRepositoryDto(47, 'Banco', 'ACCIONES', 100),
        [new AccountOrderRepositoryDto(66, 1000, 1, 'CASH_IN', 'FILLED')],
      ),
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
      expect.objectContaining({ size: 2, price: 100 }),
      transactionClient,
    );
  });

  it('persists an unaffordable order as REJECTED', async () => {
    repository.getOrderContext.mockResolvedValue(
      new OrderContextRepositoryDto(
        true,
        new InstrumentOrderContextRepositoryDto(47, 'Banco', 'ACCIONES', 100),
        [],
      ),
    );

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
      new OrderContextRepositoryDto(
        true,
        new InstrumentOrderContextRepositoryDto(47, 'Banco', 'ACCIONES', 100),
        [
          new AccountOrderRepositoryDto(66, 1000, 1, 'CASH_IN', 'FILLED'),
          new AccountOrderRepositoryDto(47, 7, 100, 'BUY', 'NEW'),
        ],
      ),
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

  it('does not sell shares already reserved by a NEW sell order', async () => {
    repository.getOrderContext.mockResolvedValue(
      new OrderContextRepositoryDto(
        true,
        new InstrumentOrderContextRepositoryDto(47, 'Banco', 'ACCIONES', 100),
        [
          new AccountOrderRepositoryDto(47, 3, 90, 'BUY', 'FILLED'),
          new AccountOrderRepositoryDto(47, 2, 110, 'SELL', 'NEW'),
        ],
      ),
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
        100,
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
});
