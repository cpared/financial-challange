import { jest } from '@jest/globals';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

describe('Orders API (e2e)', () => {
  let app: INestApplication;
  const transactionClient = new PrismaClient();
  const prismaMock = {
    $transaction: jest.fn(
      <T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) =>
        operation(transactionClient),
    ),
  };
  const createOrderSpy = jest.spyOn(transactionClient.order, 'create');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(async () => {
    jest.spyOn(transactionClient.user, 'findUnique').mockResolvedValue({
      id: 1,
      email: null,
      accountNumber: null,
    });
    const instrumentRecord = {
      id: 47,
      ticker: 'BBAR',
      name: 'Banco Frances',
      type: 'ACCIONES',
      marketdata: [
        {
          id: 1,
          instrumentId: 47,
          high: null,
          low: null,
          open: null,
          close: new Prisma.Decimal(100),
          previousClose: new Prisma.Decimal(95),
          date: new Date('2026-01-01'),
        },
      ],
    };
    jest
      .spyOn(transactionClient.instrument, 'findUnique')
      .mockResolvedValue(instrumentRecord);
    jest.spyOn(transactionClient.order, 'findMany').mockResolvedValue([
      {
        id: 1,
        instrumentId: 66,
        userId: 1,
        size: 1000,
        price: new Prisma.Decimal(1),
        type: 'MARKET',
        side: 'CASH_IN',
        status: 'FILLED',
        datetime: new Date('2026-01-01'),
      },
    ]);
    createOrderSpy.mockResolvedValue({
      id: 99,
      instrumentId: 47,
      userId: 1,
      size: 2,
      price: new Prisma.Decimal(100),
      type: 'MARKET',
      side: 'BUY',
      status: 'FILLED',
      datetime: new Date('2026-01-01T10:00:00.000Z'),
    });

    const module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
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

  it('rejects invalid LIMIT input before persisting an order', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/users/1/orders')
      .send({
        instrumentId: 47,
        side: 'BUY',
        type: 'LIMIT',
        quantity: 1,
      })
      .expect(400);

    expect(createOrderSpy).not.toHaveBeenCalled();
  });
});
