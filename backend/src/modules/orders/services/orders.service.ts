import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service.js';
import { centsToDecimal, toCents } from '../../../common/utils/cash-balance.js';
import {
  OrderSide,
  OrderStatus,
  OrderType,
} from '../../../common/enums/order.enums.js';
import { CreateOrderRepositoryInputDto } from '../repositories/dto/create-order-repository-input.dto.js';
import { OrdersRepository } from '../repositories/orders.repository.js';
import { CreateOrderServiceInputDto } from './dto/create-order-service-input.dto.js';
import { OrderServiceResponseDto } from './dto/order-service-response.dto.js';

const MAX_ORDER_SIZE = 2_147_483_647n;
const MAX_NUMERIC_CENTS = 9_999_999_999n;

@Injectable()
export class OrdersService {
  constructor(
    private readonly ordersRepository: OrdersRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(
    input: CreateOrderServiceInputDto,
  ): Promise<OrderServiceResponseDto> {
    if (input.side !== OrderSide.Buy && input.side !== OrderSide.Sell) {
      throw new BadRequestException('side must be BUY or SELL.');
    }
    if (input.type !== OrderType.Market && input.type !== OrderType.Limit) {
      throw new BadRequestException('type must be MARKET or LIMIT.');
    }
    if ((input.quantity === undefined) === (input.amountArs === undefined)) {
      throw new BadRequestException(
        'Provide exactly one of quantity or amountArs.',
      );
    }

    return this.runAccountTransaction(async (transaction) => {
      const userExists = await this.ordersRepository.acquireAccountLock(
        input.userId,
        transaction,
      );
      if (!userExists) {
        throw new NotFoundException(`User ${input.userId} was not found.`);
      }

      const context = await this.ordersRepository.getOrderContext(
        input.userId,
        input.instrumentId,
        transaction,
      );
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

      let priceInCents: bigint;
      if (input.type === OrderType.Market) {
        if (context.instrument.close === null) {
          throw new ConflictException(
            'The instrument does not have a current market price.',
          );
        }
        priceInCents = toCents(context.instrument.close);
        if (priceInCents <= 0n) {
          throw new ConflictException(
            'The instrument does not have a valid current market price.',
          );
        }
      } else {
        if (input.limitPrice === undefined) {
          throw new BadRequestException('LIMIT orders require a price.');
        }
        priceInCents = this.parsePositiveMoney(input.limitPrice, 'Limit price');
      }

      if (context.hasMissingTradePrice) {
        throw new InternalServerErrorException(
          'An existing trade order has no recorded price.',
        );
      }

      let requestedSize: bigint;
      if (input.quantity === undefined) {
        if (input.amountArs === undefined) {
          throw new BadRequestException(
            'Provide exactly one of quantity or amountArs.',
          );
        }
        requestedSize =
          this.parsePositiveMoney(input.amountArs, 'amountArs') / priceInCents;
      } else {
        requestedSize = this.parseQuantity(input.quantity);
      }
      if (requestedSize < 1n) {
        throw new BadRequestException(
          'The requested amount is not enough for one share.',
        );
      }
      if (requestedSize > MAX_ORDER_SIZE) {
        throw new BadRequestException(
          'The requested order exceeds the maximum supported share quantity.',
        );
      }

      const availableCashInCents =
        BigInt(context.cashBalanceInCents) -
        BigInt(context.reservedCashInCents);
      const availableQuantity =
        BigInt(context.effectiveQuantity) - BigInt(context.reservedQuantity);
      const requiredCashInCents = requestedSize * priceInCents;
      const hasEnoughResources =
        input.side === OrderSide.Buy
          ? requiredCashInCents <= availableCashInCents
          : requestedSize <= availableQuantity;
      const status = !hasEnoughResources
        ? OrderStatus.Rejected
        : input.type === OrderType.Market
          ? OrderStatus.Filled
          : OrderStatus.New;

      const order = await this.ordersRepository.create(
        new CreateOrderRepositoryInputDto(
          input.userId,
          input.instrumentId,
          Number(requestedSize),
          centsToDecimal(priceInCents),
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
    return this.runAccountTransaction(async (transaction) => {
      const userExists = await this.ordersRepository.acquireAccountLock(
        userId,
        transaction,
      );
      if (!userExists) {
        throw new NotFoundException(`User ${userId} was not found.`);
      }

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

  private parsePositiveMoney(value: number | string, label: string): bigint {
    let cents: bigint;
    try {
      cents = toCents(value);
    } catch (error) {
      if (error instanceof RangeError) {
        throw new BadRequestException(
          `${label} must be a positive amount with at most two decimal places.`,
        );
      }
      throw error;
    }
    if (cents <= 0n || cents > MAX_NUMERIC_CENTS) {
      throw new BadRequestException(
        `${label} must be between 0.01 and 99999999.99.`,
      );
    }
    return cents;
  }

  private parseQuantity(value: number): bigint {
    if (
      !Number.isInteger(value) ||
      value < 1 ||
      value > Number(MAX_ORDER_SIZE)
    ) {
      throw new BadRequestException(
        'quantity must be an integer between 1 and 2147483647.',
      );
    }
    return BigInt(value);
  }

  private async runAccountTransaction<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  }
}
