import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OrderStatus } from '../../../common/enums/order.enums.js';
import { CreateOrderRepositoryInputDto } from './dto/create-order-repository-input.dto.js';
import { OrderContextRepositoryDto } from './dto/order-context-repository.dto.js';
import { InstrumentOrderContextRepositoryDto } from './dto/order-context-repository.dto.js';
import { OrderRepositoryResponseDto } from './dto/order-repository-response.dto.js';

@Injectable()
export class OrdersRepository {
  async acquireAccountLock(
    userId: number,
    transaction: Prisma.TransactionClient,
  ): Promise<boolean> {
    const users = await transaction.$queryRaw<Array<{ id: number }>>(
      Prisma.sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`,
    );
    return users.length === 1;
  }

  async getOrderContext(
    userId: number,
    instrumentId: number,
    transaction: Prisma.TransactionClient,
  ): Promise<OrderContextRepositoryDto> {
    const instrument = await transaction.instrument.findUnique({
      where: { id: instrumentId },
      include: {
        marketdata: {
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          take: 1,
        },
      },
    });
    const [account] = await transaction.$queryRaw<
      Array<{
        cashBalanceInCents: string;
        reservedCashInCents: string;
        effectiveQuantity: string;
        reservedQuantity: string;
        missingTradePriceCount: string;
      }>
    >(
      Prisma.sql`
        SELECT
          TRUNC(COALESCE(SUM(CASE
            WHEN side = 'CASH_IN' AND status = 'FILLED'
              THEN COALESCE(size, 0)::numeric * 100
            WHEN side = 'CASH_OUT' AND status = 'FILLED'
              THEN -COALESCE(size, 0)::numeric * 100
            WHEN side = 'BUY' AND status = 'FILLED'
              THEN -COALESCE(size, 0)::numeric * price * 100
            WHEN side = 'SELL' AND status = 'FILLED'
              THEN COALESCE(size, 0)::numeric * price * 100
            ELSE 0::numeric
          END), 0))::text AS "cashBalanceInCents",
          TRUNC(COALESCE(SUM(CASE
            WHEN side = 'BUY' AND status = 'NEW'
              THEN COALESCE(size, 0)::numeric * price * 100
            ELSE 0::numeric
          END), 0))::text AS "reservedCashInCents",
          COALESCE(SUM(CASE
            WHEN instrumentid = ${instrumentId} AND side = 'BUY' AND status = 'FILLED'
              THEN COALESCE(size, 0)::numeric
            WHEN instrumentid = ${instrumentId} AND side = 'SELL' AND status = 'FILLED'
              THEN -COALESCE(size, 0)::numeric
            ELSE 0::numeric
          END), 0)::text AS "effectiveQuantity",
          COALESCE(SUM(CASE
            WHEN instrumentid = ${instrumentId} AND side = 'SELL' AND status = 'NEW'
              THEN COALESCE(size, 0)::numeric
            ELSE 0::numeric
          END), 0)::text AS "reservedQuantity",
          COUNT(*) FILTER (
            WHERE (status = 'FILLED' AND side IN ('BUY', 'SELL')
              OR status = 'NEW' AND side = 'BUY')
              AND price IS NULL
          )::text AS "missingTradePriceCount"
        FROM orders
        WHERE userid = ${userId}
      `,
    );
    if (!account) {
      throw new Error('Account balance aggregation returned no result.');
    }

    return new OrderContextRepositoryDto(
      instrument
        ? new InstrumentOrderContextRepositoryDto(
            instrument.id,
            instrument.name,
            instrument.type,
            instrument.marketdata[0]?.close?.toFixed(2) ?? null,
          )
        : null,
      account.cashBalanceInCents,
      account.reservedCashInCents,
      account.effectiveQuantity,
      account.reservedQuantity,
      account.missingTradePriceCount !== '0',
    );
  }

  async create(
    input: CreateOrderRepositoryInputDto,
    transaction: Prisma.TransactionClient,
  ): Promise<OrderRepositoryResponseDto> {
    const order = await transaction.order.create({
      data: {
        userId: input.userId,
        instrumentId: input.instrumentId,
        size: input.size,
        price: input.price,
        type: input.type,
        side: input.side,
        status: input.status,
        datetime: input.datetime,
      },
    });
    return this.mapOrder(order);
  }

  async findForCancellation(
    userId: number,
    orderId: number,
    transaction: Prisma.TransactionClient,
  ): Promise<OrderRepositoryResponseDto | null> {
    const order = await transaction.order.findFirst({
      where: { id: orderId, userId },
    });
    return order ? this.mapOrder(order) : null;
  }

  async cancel(
    userId: number,
    orderId: number,
    transaction: Prisma.TransactionClient,
  ): Promise<OrderRepositoryResponseDto | null> {
    const result = await transaction.order.updateMany({
      where: { id: orderId, userId, status: OrderStatus.New },
      data: { status: OrderStatus.Cancelled },
    });
    if (result.count !== 1) {
      return null;
    }

    const order = await transaction.order.findUnique({
      where: { id: orderId },
    });
    return order ? this.mapOrder(order) : null;
  }

  private mapOrder(order: {
    id: number;
    instrumentId: number | null;
    userId: number | null;
    size: number | null;
    price: Prisma.Decimal | null;
    type: string | null;
    side: string | null;
    status: string | null;
    datetime: Date | null;
  }): OrderRepositoryResponseDto {
    return new OrderRepositoryResponseDto(
      order.id,
      order.instrumentId,
      order.userId,
      order.size,
      order.price?.toFixed(2) ?? null,
      order.type,
      order.side,
      order.status,
      order.datetime,
    );
  }
}
