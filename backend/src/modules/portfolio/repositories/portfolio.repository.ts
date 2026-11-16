import { Injectable } from '@nestjs/common';
import { OrderStatus } from '../../../common/enums/order.enums.js';
import { PrismaService } from '../../../database/prisma.service.js';
import {
  PortfolioInstrumentRepositoryDto,
  PortfolioOrderRepositoryDto,
  PortfolioRepositoryResponseDto,
} from './dto/portfolio-repository-response.dto.js';

@Injectable()
export class PortfolioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: number): Promise<PortfolioRepositoryResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        status: { in: [OrderStatus.Filled, OrderStatus.New] },
      },
      include: {
        instrument: {
          include: {
            marketdata: {
              orderBy: [{ date: 'desc' }, { id: 'desc' }],
              take: 1,
            },
          },
        },
      },
    });

    return new PortfolioRepositoryResponseDto(
      userId,
      user !== null,
      orders.map((order) => {
        const instrument = order.instrument;
        const marketData = instrument?.marketdata[0];
        return new PortfolioOrderRepositoryDto(
          order.instrumentId,
          order.size,
          order.price?.toNumber() ?? null,
          order.side,
          order.status,
          instrument
            ? new PortfolioInstrumentRepositoryDto(
                instrument.id,
                instrument.ticker,
                instrument.name,
                instrument.type,
                marketData?.close?.toNumber() ?? null,
                marketData?.previousClose?.toNumber() ?? null,
              )
            : null,
        );
      }),
    );
  }
}
