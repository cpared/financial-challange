import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OrderStatus } from '../../../common/enums/order.enums.js';
import { CreateOrderRepositoryInputDto } from './dto/create-order-repository-input.dto.js';
import { OrderContextRepositoryDto } from './dto/order-context-repository.dto.js';
import { AccountOrderRepositoryDto } from './dto/order-context-repository.dto.js';
import { InstrumentOrderContextRepositoryDto } from './dto/order-context-repository.dto.js';
import { OrderRepositoryResponseDto } from './dto/order-repository-response.dto.js';

@Injectable()
export class OrdersRepository {
  async getOrderContext(
    userId: number,
    instrumentId: number,
    transaction: Prisma.TransactionClient,
  ): Promise<OrderContextRepositoryDto> {
    const user = await transaction.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    const instrument = await transaction.instrument.findUnique({
      where: { id: instrumentId },
      include: {
        marketdata: {
          orderBy: [{ date: 'desc' }, { id: 'desc' }],
          take: 1,
        },
      },
    });
    const orders = await transaction.order.findMany({
      where: {
        userId,
        status: { in: [OrderStatus.Filled, OrderStatus.New] },
      },
    });

    return new OrderContextRepositoryDto(
      user !== null,
      instrument
        ? new InstrumentOrderContextRepositoryDto(
            instrument.id,
            instrument.name,
            instrument.type,
            instrument.marketdata[0]?.close?.toNumber() ?? null,
          )
        : null,
      orders.map(
        (order) =>
          new AccountOrderRepositoryDto(
            order.instrumentId,
            order.size,
            order.price?.toNumber() ?? null,
            order.side,
            order.status,
          ),
      ),
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
      order.price?.toNumber() ?? null,
      order.type,
      order.side,
      order.status,
      order.datetime,
    );
  }
}
