import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  calculateCashBalance,
  toCents,
} from '../../../common/utils/cash-balance.js';
import {
  OrderSide,
  OrderStatus,
  OrderType,
} from '../../../common/enums/order.enums.js';
import { CreateOrderRepositoryInputDto } from '../repositories/dto/create-order-repository-input.dto.js';
import { OrdersRepository } from '../repositories/orders.repository.js';
import { CreateOrderServiceInputDto } from './dto/create-order-service-input.dto.js';
import { OrderServiceResponseDto } from './dto/order-service-response.dto.js';

const SERIALIZATION_RETRIES = 3;
const MAX_ORDER_SIZE = 2_147_483_647;

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(
    input: CreateOrderServiceInputDto,
  ): Promise<OrderServiceResponseDto> {
    return this.runSerializableTransaction(async (transaction) => {
      const context = await this.ordersRepository.getOrderContext(
        input.userId,
        input.instrumentId,
        transaction,
      );

      if (!context.userExists) {
        throw new NotFoundException(`User ${input.userId} was not found.`);
      }
      if (!context.instrument) {
        throw new NotFoundException(
          `Instrument ${input.instrumentId} was not found.`,
        );
      }
      if (context.instrument.type === 'MONEDA') {
        throw new BadRequestException(
          'Orders can only be placed for tradable instruments.',
        );
      }
      if (context.instrument.close === null || context.instrument.close <= 0) {
        throw new ConflictException(
          'The instrument does not have a current market price.',
        );
      }

      const price =
        input.type === OrderType.Market
          ? context.instrument.close
          : input.limitPrice;
      if (price === undefined || price <= 0) {
        throw new BadRequestException('LIMIT orders require a positive price.');
      }

      const priceInCents = toCents(price);
      const size =
        input.quantity ??
        Math.floor(toCents(input.amountArs ?? 0) / priceInCents);
      if (!Number.isSafeInteger(size) || size < 1 || size > MAX_ORDER_SIZE) {
        if (size > MAX_ORDER_SIZE) {
          throw new BadRequestException(
            'The requested order exceeds the maximum supported share quantity.',
          );
        }
        throw new BadRequestException(
          'The requested amount is not enough to buy or sell one share.',
        );
      }

      const totalValueInCents = size * priceInCents;
      const isBuy = input.side === OrderSide.Buy;
      const enoughResources = isBuy
        ? totalValueInCents <=
          calculateCashBalance(context.orders).availableCashInCents
        : size <=
          this.calculateAvailableQuantity(context.orders, input.instrumentId);
      const status = !enoughResources
        ? OrderStatus.Rejected
        : input.type === OrderType.Market
          ? OrderStatus.Filled
          : OrderStatus.New;

      const order = await this.ordersRepository.create(
        new CreateOrderRepositoryInputDto(
          input.userId,
          input.instrumentId,
          size,
          price,
          input.type,
          input.side,
          status,
          new Date(),
        ),
        transaction,
      );
      return OrderServiceResponseDto.map(order);
    });
  }

  async cancel(
    userId: number,
    orderId: number,
  ): Promise<OrderServiceResponseDto> {
    return this.runSerializableTransaction(async (transaction) => {
      const order = await this.ordersRepository.findForCancellation(
        userId,
        orderId,
        transaction,
      );
      if (!order) {
        throw new NotFoundException(`Order ${orderId} was not found.`);
      }
      if (order.status !== OrderStatus.New) {
        throw new ConflictException('Only NEW orders can be cancelled.');
      }

      const cancelledOrder = await this.ordersRepository.cancel(
        userId,
        orderId,
        transaction,
      );
      if (!cancelledOrder) {
        throw new ConflictException(
          'The order status changed before it could be cancelled.',
        );
      }
      return OrderServiceResponseDto.map(cancelledOrder);
    });
  }

  private calculateAvailableQuantity(
    orders: readonly {
      instrumentId: number | null;
      size: number | null;
      side: string | null;
      status: string | null;
    }[],
    instrumentId: number,
  ): number {
    let quantity = 0;
    for (const order of orders) {
      if (order.instrumentId !== instrumentId) {
        continue;
      }
      const size = order.size ?? 0;
      if (order.status === OrderStatus.Filled && order.side === OrderSide.Buy) {
        quantity += size;
      } else if (
        order.status === OrderStatus.Filled &&
        order.side === OrderSide.Sell
      ) {
        quantity -= size;
      } else if (
        order.status === OrderStatus.New &&
        order.side === OrderSide.Sell
      ) {
        quantity -= size;
      }
    }
    return quantity;
  }

  private async runSerializableTransaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 1; attempt <= SERIALIZATION_RETRIES; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          if (attempt < SERIALIZATION_RETRIES) {
            continue;
          }
          throw new ConflictException(
            'The account changed during order processing. Please retry.',
          );
        }
        throw error;
      }
    }
    throw new ConflictException(
      'The account changed during order processing. Please retry.',
    );
  }
}
