import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

interface AccountFixture {
  readonly userId: number;
  readonly instrumentId: number;
}

describe('Orders API PostgreSQL concurrency (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const fixtureUserIds = new Set<number>();
  const fixtureInstrumentIds = new Set<number>();

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) {
      throw new Error(
        'Set TEST_DATABASE_URL to a disposable PostgreSQL database before running concurrency tests.',
      );
    }

    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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

  afterEach(async () => {
    if (fixtureUserIds.size === 0) {
      return;
    }
    const userIds = [...fixtureUserIds];
    const instrumentIds = [...fixtureInstrumentIds];
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.marketData.deleteMany({
      where: { instrumentId: { in: instrumentIds } },
    });
    await prisma.instrument.deleteMany({
      where: { id: { in: instrumentIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    fixtureUserIds.clear();
    fixtureInstrumentIds.clear();
  });

  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });

  async function createAccount(options?: {
    cashArs?: number;
    close?: string | null;
    shares?: number;
  }): Promise<AccountFixture> {
    const cashArs = options?.cashArs ?? 100_000;
    const shares = options?.shares ?? 0;
    const user = await prisma.user.create({
      data: {
        email: `orders-test-${randomUUID()}@example.test`,
        accountNumber: randomUUID().replaceAll('-', '').slice(0, 20),
      },
    });
    fixtureUserIds.add(user.id);

    const instrument = await prisma.instrument.create({
      data: {
        ticker: `T${user.id}`.slice(0, 10),
        name: `Concurrency test ${user.id}`,
        type: 'ACCIONES',
      },
    });
    fixtureInstrumentIds.add(instrument.id);
    await prisma.marketData.create({
      data: {
        instrumentId: instrument.id,
        close:
          options?.close === null
            ? null
            : new Prisma.Decimal(options?.close ?? '60000.00'),
        previousClose: new Prisma.Decimal(options?.close ?? '60000.00'),
        date: new Date('2026-01-01T00:00:00.000Z'),
      },
    });

    const orders: Prisma.OrderCreateManyInput[] = [];
    if (cashArs > 0) {
      orders.push({
        userId: user.id,
        instrumentId: null,
        size: cashArs,
        price: new Prisma.Decimal(1),
        type: 'MARKET',
        side: 'CASH_IN',
        status: 'FILLED',
        datetime: new Date(),
      });
    }
    if (shares > 0) {
      orders.push({
        userId: user.id,
        instrumentId: instrument.id,
        size: shares,
        price: new Prisma.Decimal(100),
        type: 'MARKET',
        side: 'BUY',
        status: 'FILLED',
        datetime: new Date(),
      });
    }
    if (orders.length > 0) {
      await prisma.order.createMany({ data: orders });
    }

    return { userId: user.id, instrumentId: instrument.id };
  }

  function postOrder(
    account: AccountFixture,
    body: Record<string, number | string>,
  ) {
    return request(app.getHttpServer())
      .post(`/api/v1/users/${account.userId}/orders`)
      .send({ instrumentId: account.instrumentId, ...body });
  }

  async function createSellLimit(
    account: AccountFixture,
    quantity: number,
  ): Promise<number> {
    const response = await postOrder(account, {
      side: 'SELL',
      type: 'LIMIT',
      quantity,
      price: 100,
    }).expect(201);
    expect(response.body.status).toBe('NEW');
    return response.body.id as number;
  }

  it('serializes two BUY MARKET requests so no more cash than available is spent', async () => {
    const account = await createAccount();
    const responses = await Promise.all([
      postOrder(account, {
        side: 'BUY',
        type: 'MARKET',
        amountArs: 60_000,
        price: 0.01,
      }),
      postOrder(account, {
        side: 'BUY',
        type: 'MARKET',
        amountArs: 60_000,
      }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(
      responses
        .map((response) => response.body.status as string)
        .sort((left, right) => left.localeCompare(right)),
    ).toEqual(['FILLED', 'REJECTED']);
    const persisted = await prisma.order.findMany({
      where: { userId: account.userId, side: 'BUY' },
    });
    expect(
      persisted
        .map((order) => order.status ?? '')
        .sort((left, right) => left.localeCompare(right)),
    ).toEqual(['FILLED', 'REJECTED']);
    expect(
      persisted.find((order) => order.status === 'FILLED')?.price?.toFixed(2),
    ).toBe('60000.00');
    const finalOrder = await postOrder(account, {
      side: 'BUY',
      type: 'MARKET',
      quantity: 1,
    }).expect(201);
    expect(finalOrder.body.status).toBe('REJECTED');
  });

  it('reserves cash between concurrent BUY LIMIT requests', async () => {
    const account = await createAccount();
    const responses = await Promise.all([
      postOrder(account, {
        side: 'BUY',
        type: 'LIMIT',
        quantity: 1,
        price: 80_000,
      }),
      postOrder(account, {
        side: 'BUY',
        type: 'LIMIT',
        quantity: 1,
        price: 80_000,
      }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(
      responses
        .map((response) => response.body.status as string)
        .sort((left, right) => left.localeCompare(right)),
    ).toEqual(['NEW', 'REJECTED']);
    const persistedNewBuys = await prisma.order.findMany({
      where: { userId: account.userId, side: 'BUY', status: 'NEW' },
    });
    expect(persistedNewBuys).toHaveLength(1);
    const finalOrder = await postOrder(account, {
      side: 'BUY',
      type: 'MARKET',
      quantity: 1,
    }).expect(201);
    expect(finalOrder.body.status).toBe('REJECTED');
  });

  it('does not approve concurrent MARKET and LIMIT buys beyond the initial balance', async () => {
    const account = await createAccount();
    const responses = await Promise.all([
      postOrder(account, {
        side: 'BUY',
        type: 'MARKET',
        amountArs: 60_000,
      }),
      postOrder(account, {
        side: 'BUY',
        type: 'LIMIT',
        quantity: 1,
        price: 60_000,
      }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(
      responses.filter((response) => response.body.status !== 'REJECTED'),
    ).toHaveLength(1);
    const accepted = await prisma.order.findMany({
      where: {
        userId: account.userId,
        status: { in: ['FILLED', 'NEW'] },
        side: 'BUY',
      },
    });
    const committedCents = accepted.reduce(
      (total, order) =>
        total +
        BigInt(order.size ?? 0) * BigInt(order.price?.mul(100).toFixed(0) ?? 0),
      0n,
    );
    expect(committedCents).toBeLessThanOrEqual(10_000_000n);
  });

  it('serializes two SELL MARKET requests against available holdings', async () => {
    const account = await createAccount({ cashArs: 1_000_000, shares: 10 });
    const responses = await Promise.all([
      postOrder(account, { side: 'SELL', type: 'MARKET', quantity: 7 }),
      postOrder(account, { side: 'SELL', type: 'MARKET', quantity: 7 }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(
      responses
        .map((response) => response.body.status as string)
        .sort((left, right) => left.localeCompare(right)),
    ).toEqual(['FILLED', 'REJECTED']);
    const sells = await prisma.order.findMany({
      where: { userId: account.userId, instrumentId: account.instrumentId },
    });
    const effectiveShares = sells.reduce(
      (total, order) =>
        order.status === 'FILLED' && order.side === 'BUY'
          ? total + (order.size ?? 0)
          : order.status === 'FILLED' && order.side === 'SELL'
            ? total - (order.size ?? 0)
            : total,
      0,
    );
    expect(effectiveShares).toBe(3);
  });

  it('reserves shares between concurrent SELL LIMIT requests', async () => {
    const account = await createAccount({ cashArs: 1_000_000, shares: 10 });
    const responses = await Promise.all([
      postOrder(account, {
        side: 'SELL',
        type: 'LIMIT',
        quantity: 7,
        price: 100,
      }),
      postOrder(account, {
        side: 'SELL',
        type: 'LIMIT',
        quantity: 7,
        price: 100,
      }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(
      responses
        .map((response) => response.body.status as string)
        .sort((left, right) => left.localeCompare(right)),
    ).toEqual(['NEW', 'REJECTED']);
    const newSells = await prisma.order.findMany({
      where: {
        userId: account.userId,
        instrumentId: account.instrumentId,
        side: 'SELL',
        status: 'NEW',
      },
    });
    expect(newSells).toHaveLength(1);
    expect(newSells[0]?.size).toBe(7);
  });

  it('serializes cancellation with a new SELL MARKET request', async () => {
    const account = await createAccount({ cashArs: 1_000_000, shares: 10 });
    const reservedOrderId = await createSellLimit(account, 7);
    const [cancelResponse, sellResponse] = await Promise.all([
      request(app.getHttpServer()).patch(
        `/api/v1/users/${account.userId}/orders/${reservedOrderId}/cancel`,
      ),
      postOrder(account, { side: 'SELL', type: 'MARKET', quantity: 7 }),
    ]);

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.status).toBe('CANCELLED');
    expect(sellResponse.status).toBe(201);
    expect(['FILLED', 'REJECTED']).toContain(sellResponse.body.status);

    const persisted = await prisma.order.findMany({
      where: { userId: account.userId, instrumentId: account.instrumentId },
    });
    expect(
      persisted.find((order) => order.id === reservedOrderId)?.status,
    ).toBe('CANCELLED');
    const remainingShares = persisted.reduce(
      (total, order) =>
        order.status === 'FILLED' && order.side === 'BUY'
          ? total + (order.size ?? 0)
          : order.status === 'FILLED' && order.side === 'SELL'
            ? total - (order.size ?? 0)
            : order.status === 'NEW' && order.side === 'SELL'
              ? total - (order.size ?? 0)
              : total,
      0,
    );
    expect(remainingShares).toBeGreaterThanOrEqual(0);
    expect(remainingShares).toBeLessThanOrEqual(10);
  });

  it('releases BUY and SELL reservations after cancellation', async () => {
    const buyAccount = await createAccount();
    const buyLimit = await postOrder(buyAccount, {
      side: 'BUY',
      type: 'LIMIT',
      quantity: 1,
      price: 80_000,
    }).expect(201);
    await request(app.getHttpServer())
      .patch(
        `/api/v1/users/${buyAccount.userId}/orders/${buyLimit.body.id}/cancel`,
      )
      .expect(200);
    expect(
      await postOrder(buyAccount, {
        side: 'BUY',
        type: 'MARKET',
        amountArs: 60_000,
      }).then((response) => response.body.status),
    ).toBe('FILLED');

    const sellAccount = await createAccount({
      cashArs: 1_000_000,
      shares: 10,
    });
    const sellLimitId = await createSellLimit(sellAccount, 7);
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${sellAccount.userId}/orders/${sellLimitId}/cancel`)
      .expect(200);
    expect(
      (
        await postOrder(sellAccount, {
          side: 'SELL',
          type: 'MARKET',
          quantity: 7,
        })
      ).body.status,
    ).toBe('FILLED');
  });

  it('cancels a NEW order exactly once when cancellation requests race', async () => {
    const account = await createAccount();
    const limit = await postOrder(account, {
      side: 'BUY',
      type: 'LIMIT',
      quantity: 1,
      price: 80_000,
    }).expect(201);
    const cancelPath = `/api/v1/users/${account.userId}/orders/${limit.body.id}/cancel`;

    const responses = await Promise.all([
      request(app.getHttpServer()).patch(cancelPath),
      request(app.getHttpServer()).patch(cancelPath),
    ]);

    expect(
      responses.map((response) => response.status).sort((a, b) => a - b),
    ).toEqual([200, 409]);
    const persisted = await prisma.order.findMany({
      where: { userId: account.userId, id: limit.body.id },
    });
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.status).toBe('CANCELLED');
  });

  it('allows LIMIT without market data but rejects MARKET without a close', async () => {
    const account = await createAccount({ close: null });
    const limit = await postOrder(account, {
      side: 'BUY',
      type: 'LIMIT',
      quantity: 1,
      price: 80,
    }).expect(201);
    expect(limit.body.status).toBe('NEW');
    await postOrder(account, {
      side: 'BUY',
      type: 'MARKET',
      quantity: 1,
    }).expect(409);

    const invalidCloseAccount = await createAccount({ close: '0.00' });
    await postOrder(invalidCloseAccount, {
      side: 'BUY',
      type: 'MARKET',
      quantity: 1,
    }).expect(409);
  });

  it('uses the LIMIT price to derive quantity and reserve funds, not market close', async () => {
    const account = await createAccount();
    const response = await postOrder(account, {
      side: 'BUY',
      type: 'LIMIT',
      amountArs: 40_000,
      price: 20_000,
    }).expect(201);

    expect(response.body).toMatchObject({
      size: 2,
      price: 20_000,
      status: 'NEW',
    });
    const followingMarketBuy = await postOrder(account, {
      side: 'BUY',
      type: 'MARKET',
      quantity: 1,
    }).expect(201);
    expect(followingMarketBuy.body.status).toBe('FILLED');
  });

  it('rejects invalid sides, types, sizes, prices, and amounts at the HTTP boundary', async () => {
    const account = await createAccount();
    const invalidRequests: Array<Record<string, number | string>> = [
      { side: 'BUY', type: 'MARKET' },
      { side: 'BUY', type: 'MARKET', quantity: 1, amountArs: 1 },
      { side: 'BUY', type: 'MARKET', quantity: 0 },
      { side: 'BUY', type: 'MARKET', quantity: -1 },
      { side: 'BUY', type: 'MARKET', quantity: 2_147_483_648 },
      { side: 'BUY', type: 'MARKET', amountArs: 0 },
      { side: 'BUY', type: 'MARKET', amountArs: -1 },
      { side: 'BUY', type: 'MARKET', amountArs: 0.001 },
      { side: 'BUY', type: 'MARKET', amountArs: 100_000_000 },
      { side: 'BUY', type: 'LIMIT', quantity: 1 },
      { side: 'BUY', type: 'LIMIT', quantity: 1, price: 0 },
      { side: 'BUY', type: 'LIMIT', quantity: 1, price: -1 },
      { side: 'BUY', type: 'LIMIT', quantity: 1, price: 0.001 },
      {
        side: 'BUY',
        type: 'LIMIT',
        quantity: 1,
        price: 100_000_000,
      },
      { side: 'SHORT', type: 'MARKET', quantity: 1 },
      { side: 'BUY', type: 'STOP', quantity: 1 },
    ];

    for (const body of invalidRequests) {
      await postOrder(account, body).expect(400);
    }
  });

  it('rejects MONEDA instruments and oversized amount-derived quantities', async () => {
    const account = await createAccount();
    const currency = await prisma.instrument.create({
      data: {
        ticker: `M${account.userId}`.slice(0, 10),
        name: 'Cash',
        type: 'MONEDA',
      },
    });
    fixtureInstrumentIds.add(currency.id);
    await prisma.marketData.create({
      data: {
        instrumentId: currency.id,
        close: new Prisma.Decimal(1),
        previousClose: new Prisma.Decimal(1),
        date: new Date('2026-01-01'),
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/users/${account.userId}/orders`)
      .send({
        instrumentId: currency.id,
        side: 'BUY',
        type: 'MARKET',
        quantity: 1,
      })
      .expect(400);

    await postOrder(account, {
      side: 'BUY',
      type: 'LIMIT',
      amountArs: 99_999_999.99,
      price: 0.01,
    }).expect(400);
  });

  it('keeps monetary calculations exact for decimal prices and database numeric limits', async () => {
    const account = await createAccount({
      cashArs: 2_147_483_647,
      close: '0.10',
    });
    const fractional = await postOrder(account, {
      side: 'BUY',
      type: 'MARKET',
      amountArs: 0.29,
    }).expect(201);
    expect(fractional.body).toMatchObject({
      size: 2,
      price: 0.1,
      status: 'FILLED',
    });

    const oversizedCost = await postOrder(account, {
      side: 'BUY',
      type: 'LIMIT',
      quantity: 2_147_483_647,
      price: 99_999_999.99,
    }).expect(201);
    expect(oversizedCost.body.status).toBe('REJECTED');
    const persisted = await prisma.order.findUnique({
      where: { id: fractional.body.id as number },
    });
    expect(persisted?.price?.toFixed(2)).toBe('0.10');
  });
});
