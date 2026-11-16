import { jest } from '@jest/globals';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { OrdersRepository } from '../src/modules/orders/repositories/orders.repository.js';
import {
  InstrumentOrderContextRepositoryDto,
  OrderContextRepositoryDto,
  OrderMovementRepositoryDto,
} from '../src/modules/orders/repositories/dto/order-context-repository.dto.js';
import { CreateOrderRepositoryInputDto } from '../src/modules/orders/repositories/dto/create-order-repository-input.dto.js';
import { OrderRepositoryResponseDto } from '../src/modules/orders/repositories/dto/order-repository-response.dto.js';

describe('Orders API (e2e)', () => {
  let app: INestApplication;
  const transactionClient = new PrismaClient();
  const prismaMock = {
    $transaction: jest.fn(
      <T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) =>
        operation(transactionClient),
    ),
  };
  const ordersRepositoryMock = {
    acquireAccountLock: jest.fn<OrdersRepository['acquireAccountLock']>(),
    getOrderContext: jest.fn<OrdersRepository['getOrderContext']>(),
    create: jest.fn<OrdersRepository['create']>(),
    findForCancellation: jest.fn<OrdersRepository['findForCancellation']>(),
    cancel: jest.fn<OrdersRepository['cancel']>(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(async () => {
    ordersRepositoryMock.acquireAccountLock.mockResolvedValue(true);
    ordersRepositoryMock.getOrderContext.mockResolvedValue(
      new OrderContextRepositoryDto(
        new InstrumentOrderContextRepositoryDto(
          47,
          'Banco Frances',
          'ACCIONES',
          '100.00',
        ),
        [new OrderMovementRepositoryDto(null, 1000, null, 'CASH_IN', 'FILLED')],
      ),
    );
    ordersRepositoryMock.create.mockImplementation(
      async (input: CreateOrderRepositoryInputDto) =>
        new OrderRepositoryResponseDto(
          99,
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

    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(OrdersRepository)
      .useValue(ordersRepositoryMock)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await transactionClient.$disconnect();
  });

  it('creates a MARKET order through the HTTP pipeline', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/users/1/orders')
      .send({
        instrumentId: 47,
        side: 'BUY',
        type: 'MARKET',
        quantity: 2,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: 99,
          instrumentId: 47,
          userId: 1,
          size: 2,
          price: 100,
          status: 'FILLED',
        });
      });
  });

  it('rejects invalid LIMIT input before acquiring or persisting an order', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/users/1/orders')
      .send({
        instrumentId: 47,
        side: 'BUY',
        type: 'LIMIT',
        quantity: 1,
      })
      .expect(400);

    expect(ordersRepositoryMock.acquireAccountLock).not.toHaveBeenCalled();
    expect(ordersRepositoryMock.create).not.toHaveBeenCalled();
  });
});
