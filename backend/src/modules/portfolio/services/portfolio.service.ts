import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OrderSide, OrderStatus } from '../../../common/enums/order.enums.js';
import {
  calculateCashBalance,
  fromCents,
  toCents,
} from '../../../common/utils/cash-balance.js';
import { PortfolioRepository } from '../repositories/portfolio.repository.js';
import {
  PortfolioPositionServiceResponseDto,
  PortfolioServiceResponseDto,
} from './dto/portfolio-service-response.dto.js';

@Injectable()
export class PortfolioService {
  constructor(private readonly portfolioRepository: PortfolioRepository) {}

  async getPortfolio(userId: number): Promise<PortfolioServiceResponseDto> {
    const portfolio = await this.portfolioRepository.findByUserId(userId);
    if (!portfolio.userExists) {
      throw new NotFoundException(`User ${userId} was not found.`);
    }

    const cashBalance = calculateCashBalance(portfolio.orders);
    const quantities = new Map<number, number>();
    const instruments = new Map<
      number,
      NonNullable<(typeof portfolio.orders)[number]['instrument']>
    >();

    for (const order of portfolio.orders) {
      const instrument = order.instrument;
      if (
        !instrument ||
        instrument.type === 'MONEDA' ||
        order.instrumentId === null
      ) {
        continue;
      }

      const hasFilledTrade = order.status === OrderStatus.Filled;
      const isBuy = order.side === OrderSide.Buy;
      const isSell = order.side === OrderSide.Sell;
      if (hasFilledTrade && (isBuy || isSell)) {
        const size = order.size ?? 0;
        const signedSize = isBuy ? size : -size;
        quantities.set(
          order.instrumentId,
          (quantities.get(order.instrumentId) ?? 0) + signedSize,
        );
        instruments.set(order.instrumentId, instrument);
      }
    }

    const positions: PortfolioPositionServiceResponseDto[] = [];
    for (const [instrumentId, quantity] of quantities) {
      if (quantity <= 0) {
        continue;
      }

      const instrument = instruments.get(instrumentId);
      if (!instrument || instrument.close === null) {
        throw new ServiceUnavailableException(
          `Market data is unavailable for instrument ${instrumentId}.`,
        );
      }

      const close = instrument.close;
      const marketValueInCents = quantity * toCents(close);
      const dailyReturnPercent =
        instrument.previousClose !== null && instrument.previousClose > 0
          ? Number(
              (
                ((close - instrument.previousClose) /
                  instrument.previousClose) *
                100
              ).toFixed(2),
            )
          : null;
      positions.push(
        new PortfolioPositionServiceResponseDto(
          instrumentId,
          instrument.ticker,
          instrument.name,
          quantity,
          fromCents(marketValueInCents),
          dailyReturnPercent,
        ),
      );
    }

    positions.sort((left, right) =>
      (left.ticker ?? '').localeCompare(right.ticker ?? ''),
    );
    const totalMarketValueInCents = positions.reduce(
      (total, position) => total + toCents(position.marketValueArs),
      0,
    );

    return PortfolioServiceResponseDto.fromRepository(
      portfolio,
      fromCents(cashBalance.cashBalanceInCents + totalMarketValueInCents),
      fromCents(cashBalance.availableCashInCents),
      positions,
    );
  }
}
