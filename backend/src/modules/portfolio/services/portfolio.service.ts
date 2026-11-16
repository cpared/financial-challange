import {
  InternalServerErrorException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OrderSide, OrderStatus } from '../../../common/enums/order.enums.js';
import {
  calculateCashBalance,
  centsToDecimal,
  toCents,
} from '../../../common/utils/cash-balance.js';
import { PortfolioRepository } from '../repositories/portfolio.repository.js';
import {
  PortfolioInstrumentRepositoryDto,
} from '../repositories/dto/portfolio-repository-response.dto.js';
import {
  FilledTrade,
  calculateWeightedAverageCostBasis,
  calculateTotalPositionReturn,
  formatPercent,
  formatRationalCents,
} from './weighted-average-cost.js';
import {
  PortfolioPositionServiceResponseDto,
  PortfolioServiceResponseDto,
} from './dto/portfolio-service-response.dto.js';

const MAX_ORDER_SIZE = 2_147_483_647;
const MAX_NUMERIC_CENTS = 9_999_999_999n;
const MAX_API_CENTS = 4_503_599_627_370_496n;

@Injectable()
export class PortfolioService {
  constructor(private readonly portfolioRepository: PortfolioRepository) {}

  async getPortfolio(userId: number): Promise<PortfolioServiceResponseDto> {
    const portfolio = await this.portfolioRepository.findByUserId(userId);
    if (!portfolio.userExists) {
      throw new NotFoundException(`User ${userId} was not found.`);
    }

    const trades: FilledTrade[] = [];
    const instruments = new Map<number, PortfolioInstrumentRepositoryDto>();

    for (const order of portfolio.orders) {
      if (
        order.status !== OrderStatus.Filled ||
        (order.side !== OrderSide.Buy && order.side !== OrderSide.Sell)
      ) {
        continue;
      }

      if (
        order.size === null ||
        !Number.isInteger(order.size) ||
        order.size <= 0 ||
        order.size > MAX_ORDER_SIZE
      ) {
        throw this.inconsistentPortfolio();
      }
      if (order.instrumentId === null || order.instrumentId <= 0) {
        throw this.inconsistentPortfolio();
      }
      if (
        !order.instrument ||
        order.instrument.id !== order.instrumentId ||
        order.instrument.type === 'MONEDA'
      ) {
        throw this.inconsistentPortfolio();
      }
      if (!order.datetime || !Number.isFinite(order.datetime.getTime())) {
        throw this.inconsistentPortfolio();
      }

      const priceInCents = this.parseStoredMoney(order.price);
      if (priceInCents <= 0n) {
        throw this.inconsistentPortfolio();
      }
      instruments.set(order.instrumentId, order.instrument);
      trades.push({
        instrumentId: order.instrumentId,
        orderId: order.id,
        datetime: order.datetime,
        side: order.side,
        quantity: BigInt(order.size),
        priceInCents,
      });
    }

    trades.sort(
      (left, right) =>
        left.datetime.getTime() - right.datetime.getTime() ||
        left.orderId - right.orderId,
    );

    let positionsByInstrument: ReturnType<
      typeof calculateWeightedAverageCostBasis
    >;
    try {
      positionsByInstrument = calculateWeightedAverageCostBasis(trades);
    } catch (error) {
      if (error instanceof RangeError) {
        throw this.inconsistentPortfolio();
      }
      throw error;
    }

    const cashBalance = calculateCashBalance(portfolio.orders);
    let totalMarketValueInCents = 0n;
    const positions: PortfolioPositionServiceResponseDto[] = [];
    for (const [instrumentId, position] of positionsByInstrument) {
      if (position.quantity < 0n) {
        throw this.inconsistentPortfolio();
      }
      if (position.quantity === 0n) {
        continue;
      }
      if (position.quantity > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw this.inconsistentPortfolio();
      }

      const instrument = instruments.get(instrumentId);
      if (!instrument) {
        throw this.inconsistentPortfolio();
      }
      if (instrument.close === null || instrument.previousClose === null) {
        throw new ServiceUnavailableException(
          'Market data is currently unavailable for one or more positions.',
        );
      }

      const closeInCents = this.parseStoredMoney(instrument.close);
      const previousCloseInCents = this.parseStoredMoney(
        instrument.previousClose,
      );
      if (closeInCents <= 0n || previousCloseInCents <= 0n) {
        throw this.inconsistentPortfolio();
      }

      const marketValueInCents = position.quantity * closeInCents;
      this.assertApiMoneyRange(marketValueInCents);
      totalMarketValueInCents += marketValueInCents;
      const totalReturn = calculateTotalPositionReturn(
        marketValueInCents,
        position.acquisitionCostInCents,
      );
      const totalReturnArs = formatRationalCents(totalReturn.profitInCents);
      this.parseApiMoney(totalReturnArs);
      if (totalReturn.returnPercent !== null) {
        this.parseApiMoney(totalReturn.returnPercent);
      }

      const dailyReturnPercent = formatPercent(
        closeInCents - previousCloseInCents,
        previousCloseInCents,
      );
      this.parseApiMoney(dailyReturnPercent);

      positions.push(
        new PortfolioPositionServiceResponseDto(
          instrumentId,
          instrument.ticker,
          instrument.name,
          Number(position.quantity),
          this.apiMoney(marketValueInCents),
          totalReturnArs,
          totalReturn.returnPercent,
          dailyReturnPercent,
        ),
      );
    }

    positions.sort((left, right) =>
      (left.ticker ?? '').localeCompare(right.ticker ?? ''),
    );
    const totalAccountValueInCents =
      cashBalance.cashBalanceInCents + totalMarketValueInCents;
    this.assertApiMoneyRange(totalAccountValueInCents);
    this.assertApiMoneyRange(cashBalance.availableCashInCents);
    return PortfolioServiceResponseDto.fromRepository(
      portfolio,
      this.apiMoney(totalAccountValueInCents),
      this.apiMoney(cashBalance.availableCashInCents),
      positions,
    );
  }

  private parseStoredMoney(value: number | string | null): bigint {
    if (value === null) {
      throw this.inconsistentPortfolio();
    }
    let cents: bigint;
    try {
      cents = toCents(value);
    } catch (error) {
      if (error instanceof RangeError) {
        throw this.inconsistentPortfolio();
      }
      throw error;
    }
    if (cents < -MAX_NUMERIC_CENTS || cents > MAX_NUMERIC_CENTS) {
      throw this.inconsistentPortfolio();
    }
    return cents;
  }

  private inconsistentPortfolio(): InternalServerErrorException {
    return new InternalServerErrorException(
      'Portfolio data is inconsistent and cannot be calculated.',
    );
  }

  private assertApiMoneyRange(amountInCents: bigint): void {
    if (
      amountInCents > MAX_API_CENTS ||
      amountInCents < -MAX_API_CENTS
    ) {
      throw this.inconsistentPortfolio();
    }
  }

  private apiMoney(amountInCents: bigint): string {
    this.assertApiMoneyRange(amountInCents);
    return centsToDecimal(amountInCents);
  }

  private parseApiMoney(value: string): bigint {
    let cents: bigint;
    try {
      cents = toCents(value);
    } catch (error) {
      if (error instanceof RangeError) {
        throw this.inconsistentPortfolio();
      }
      throw error;
    }
    this.assertApiMoneyRange(cents);
    return cents;
  }
}
