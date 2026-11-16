import { Injectable } from '@nestjs/common';
import { OrderSide, OrderStatus } from '../../../common/enums/order.enums.js';
import { toCents } from '../../../common/utils/cash-balance.js';
import {
  PortfolioInstrumentRepositoryDto,
  PortfolioOrderRepositoryDto,
} from '../repositories/dto/portfolio-repository-response.dto.js';
import type {
  FilledTrade,
  PositionCostBasis,
} from './cost-basis/cost-basis.strategy.js';
import {
  PortfolioDataIntegrityError,
  PortfolioMarketDataUnavailableError,
} from './portfolio-errors.js';

const MAX_ORDER_SIZE = 2_147_483_647;
const MAX_NUMERIC_CENTS = 9_999_999_999n;
const MAX_API_CENTS = 4_503_599_627_370_496n;

export interface ValidatedPortfolioData {
  readonly trades: FilledTrade[];
  readonly instruments: ReadonlyMap<number, PortfolioInstrumentRepositoryDto>;
}

export interface ValidatedOpenPosition {
  readonly instrumentId: number;
  readonly instrument: PortfolioInstrumentRepositoryDto;
  readonly costBasis: PositionCostBasis;
  readonly closeInCents: bigint;
  readonly previousCloseInCents: bigint;
}

@Injectable()
export class PortfolioValidator {
  validateOrders(
    orders: readonly PortfolioOrderRepositoryDto[],
  ): ValidatedPortfolioData {
    const trades: FilledTrade[] = [];
    const instruments = new Map<number, PortfolioInstrumentRepositoryDto>();

    for (const order of orders) {
      if (this.isCashMovement(order)) {
        this.validateCashMovement(order);
        continue;
      }

      if (order.status === OrderStatus.New && order.side === OrderSide.Buy) {
        this.validateQuantity(order.size);
        this.parsePositiveMoney(order.price);
        continue;
      }

      if (
        order.status !== OrderStatus.Filled ||
        (order.side !== OrderSide.Buy && order.side !== OrderSide.Sell)
      ) {
        continue;
      }

      const quantity = this.validateQuantity(order.size);
      if (order.instrumentId === null || order.instrumentId <= 0) {
        throw new PortfolioDataIntegrityError();
      }
      if (
        !order.instrument ||
        order.instrument.id !== order.instrumentId ||
        order.instrument.type === 'MONEDA'
      ) {
        throw new PortfolioDataIntegrityError();
      }
      if (!order.datetime || !Number.isFinite(order.datetime.getTime())) {
        throw new PortfolioDataIntegrityError();
      }

      const priceInCents = this.parsePositiveMoney(order.price);
      instruments.set(order.instrumentId, order.instrument);
      trades.push({
        instrumentId: order.instrumentId,
        orderId: order.id,
        datetime: order.datetime,
        side: order.side,
        quantity: BigInt(quantity),
        priceInCents,
      });
    }

    trades.sort(
      (left, right) =>
        left.datetime.getTime() - right.datetime.getTime() ||
        left.orderId - right.orderId,
    );
    return { trades, instruments };
  }

  validateOpenPositions(
    costBases: ReadonlyMap<number, PositionCostBasis>,
    instruments: ReadonlyMap<number, PortfolioInstrumentRepositoryDto>,
  ): ValidatedOpenPosition[] {
    const positions: ValidatedOpenPosition[] = [];
    for (const [instrumentId, costBasis] of costBases) {
      if (costBasis.quantity < 0n) {
        throw new PortfolioDataIntegrityError();
      }
      if (costBasis.quantity === 0n) {
        continue;
      }
      if (costBasis.quantity > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new PortfolioDataIntegrityError();
      }

      const instrument = instruments.get(instrumentId);
      if (!instrument) {
        throw new PortfolioDataIntegrityError();
      }
      if (instrument.close === null || instrument.previousClose === null) {
        throw new PortfolioMarketDataUnavailableError();
      }

      const closeInCents = this.parseStoredMoney(instrument.close);
      const previousCloseInCents = this.parseStoredMoney(
        instrument.previousClose,
      );
      if (closeInCents <= 0n || previousCloseInCents <= 0n) {
        throw new PortfolioDataIntegrityError();
      }
      this.assertApiMoneyRange(costBasis.quantity * closeInCents);

      positions.push({
        instrumentId,
        instrument,
        costBasis,
        closeInCents,
        previousCloseInCents,
      });
    }
    return positions;
  }

  validatePortfolioValue(valueInCents: bigint): void {
    this.assertApiMoneyRange(valueInCents);
  }

  private isCashMovement(order: PortfolioOrderRepositoryDto): boolean {
    return order.side === 'CASH_IN' || order.side === 'CASH_OUT';
  }

  private validateCashMovement(order: PortfolioOrderRepositoryDto): void {
    if (order.status === OrderStatus.Filled) {
      this.validateQuantity(order.size);
    }
  }

  private validateQuantity(size: number | null): number {
    if (
      size === null ||
      !Number.isInteger(size) ||
      size <= 0 ||
      size > MAX_ORDER_SIZE
    ) {
      throw new PortfolioDataIntegrityError();
    }
    return size;
  }

  private parsePositiveMoney(value: number | string | null): bigint {
    const cents = this.parseStoredMoney(value);
    if (cents <= 0n) {
      throw new PortfolioDataIntegrityError();
    }
    return cents;
  }

  private parseStoredMoney(value: number | string | null): bigint {
    if (value === null) {
      throw new PortfolioDataIntegrityError();
    }
    let cents: bigint;
    try {
      cents = toCents(value);
    } catch (error) {
      if (error instanceof RangeError) {
        throw new PortfolioDataIntegrityError();
      }
      throw error;
    }
    if (cents < -MAX_NUMERIC_CENTS || cents > MAX_NUMERIC_CENTS) {
      throw new PortfolioDataIntegrityError();
    }
    return cents;
  }

  private assertApiMoneyRange(amountInCents: bigint): void {
    if (amountInCents > MAX_API_CENTS || amountInCents < -MAX_API_CENTS) {
      throw new PortfolioDataIntegrityError();
    }
  }
}
