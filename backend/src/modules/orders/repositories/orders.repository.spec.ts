import { jest } from '@jest/globals';
import { Prisma, PrismaClient } from '@prisma/client';
import { OrderSide, OrderStatus } from '../../../common/enums/order.enums.js';
import { CreateOrderRepositoryInputDto } from './dto/create-order-repository-input.dto.js';
import { OrdersRepository } from './orders.repository.js';
import { TelemetryService } from '../../../common/observability/telemetry.service.js';

describe('OrdersRepository', () => {
  let repository: OrdersRepository;
  let transaction: PrismaClient;

  beforeEach(() => {
    repository = new OrdersRepository(new TelemetryService());
    transaction = new PrismaClient();
  });

  afterEach(async () => {
    await transaction.$disconnect();
  });

  it('locks the account and maps order movements with latest market data', async () => {
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
      .spyOn(transaction.instrument, 'findUnique')
      .mockResolvedValue(instrumentRecord);
    const rawQuerySpy = jest
      .spyOn(transaction, '$queryRaw')
      .mockResolvedValueOnce([{ id: 1 }] as never);
    const findManySpy = jest
      .spyOn(transaction.order, 'findMany')
      .mockResolvedValue([
        {
          id: 1,
          type: 'MARKET',
          instrumentId: 47,
          userId: 1,
          size: 8,
          price: new Prisma.Decimal(100),
          side: OrderSide.Buy,
          status: OrderStatus.Filled,
          datetime: new Date('2026-01-01'),
        },
        {
          id: 2,
          type: 'LIMIT',
          instrumentId: 47,
          userId: 1,
          size: 1,
          price: new Prisma.Decimal(100),
          side: OrderSide.Buy,
          status: OrderStatus.New,
          datetime: new Date('2026-01-02'),
        },
      ]);

    await expect(repository.acquireAccountLock(1, transaction)).resolves.toBe(
      true,
    );
    const result = await repository.getOrderContext(1, 47, transaction);

    expect(result).toMatchObject({
      instrument: { id: 47, close: '100.00' },
      orderMovements: [
        {
          instrumentId: 47,
          size: 8,
          price: '100.00',
          side: OrderSide.Buy,
          status: OrderStatus.Filled,
        },
        {
          instrumentId: 47,
          size: 1,
          price: '100.00',
          side: OrderSide.Buy,
          status: OrderStatus.New,
        },
      ],
    });
    expect(rawQuerySpy).toHaveBeenCalledTimes(1);
    expect(findManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 1,
          status: { in: [OrderStatus.Filled, OrderStatus.New] },
        },
      }),
    );
  });

  it('persists an order with the provided calculated fields', async () => {
    const datetime = new Date('2026-01-01');
    jest.spyOn(transaction.order, 'create').mockResolvedValue({
      id: 2,
      instrumentId: 47,
      userId: 1,
      size: 3,
      price: new Prisma.Decimal(100),
      type: 'LIMIT',
      side: 'BUY',
      status: OrderStatus.New,
      datetime,
    });

    const result = await repository.create(
      new CreateOrderRepositoryInputDto(
        1,
        47,
        3,
        '100.00',
        'LIMIT',
        'BUY',
        OrderStatus.New,
        datetime,
      ),
      transaction,
    );

    expect(result).toMatchObject({
      id: 2,
      userId: 1,
      instrumentId: 47,
      size: 3,
      price: '100.00',
      status: OrderStatus.New,
    });
  });

  it('cancels only an order that is still NEW', async () => {
    const updateManySpy = jest
      .spyOn(transaction.order, 'updateMany')
      .mockResolvedValue({ count: 1 });
    jest.spyOn(transaction.order, 'findUnique').mockResolvedValue({
      id: 5,
      instrumentId: 47,
      userId: 1,
      size: 1,
      price: new Prisma.Decimal(100),
      type: 'LIMIT',
      side: 'BUY',
      status: OrderStatus.Cancelled,
      datetime: new Date('2026-01-01'),
    });

    const result = await repository.cancel(1, 5, transaction);

    expect(result?.status).toBe(OrderStatus.Cancelled);
    expect(updateManySpy).toHaveBeenCalledWith({
      where: { id: 5, userId: 1, status: OrderStatus.New },
      data: { status: OrderStatus.Cancelled },
    });
  });
});
