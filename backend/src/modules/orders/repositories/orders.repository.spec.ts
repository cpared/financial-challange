import { jest } from '@jest/globals';
import { Prisma, PrismaClient } from '@prisma/client';
import { OrderStatus } from '../../../common/enums/order.enums.js';
import { CreateOrderRepositoryInputDto } from './dto/create-order-repository-input.dto.js';
import { OrdersRepository } from './orders.repository.js';

describe('OrdersRepository', () => {
  let repository: OrdersRepository;
  let transaction: PrismaClient;

  beforeEach(() => {
    repository = new OrdersRepository();
    transaction = new PrismaClient();
  });

  afterEach(async () => {
    await transaction.$disconnect();
  });

  it('locks the account and maps exact database aggregates with latest market data', async () => {
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
    const rawQuerySpy = jest.spyOn(transaction, '$queryRaw');
    rawQuerySpy
      .mockResolvedValueOnce([{ id: 1 }] as never)
      .mockResolvedValueOnce([
        {
          cashBalanceInCents: '100000',
          reservedCashInCents: '10000',
          effectiveQuantity: '8',
          reservedQuantity: '2',
          missingTradePriceCount: '0',
        },
      ] as never);

    await expect(repository.acquireAccountLock(1, transaction)).resolves.toBe(
      true,
    );
    const result = await repository.getOrderContext(1, 47, transaction);

    expect(result).toMatchObject({
      instrument: { id: 47, close: '100.00' },
      cashBalanceInCents: '100000',
      reservedCashInCents: '10000',
      effectiveQuantity: '8',
      reservedQuantity: '2',
      hasMissingTradePrice: false,
    });
    expect(rawQuerySpy).toHaveBeenCalledTimes(2);
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
