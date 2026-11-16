import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service.js';
import { TelemetryService } from '../../../common/observability/telemetry.service.js';
import { InstrumentRepositoryResponseDto } from './dto/instrument-repository-response.dto.js';

@Injectable()
export class InstrumentsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telemetry: TelemetryService,
  ) {}

  async search(query: string): Promise<InstrumentRepositoryResponseDto[]> {
    return this.telemetry.runInSpan(
      'db.instruments.search',
      {
        'app.repository': 'InstrumentsRepository',
        'db.system.name': 'postgresql',
        'db.operation.name': 'findMany',
      },
      async () => {
        const instruments = await this.prisma.instrument.findMany({
          where: {
            OR: [
              { ticker: { contains: query, mode: 'insensitive' } },
              { name: { contains: query, mode: 'insensitive' } },
            ],
          },
          orderBy: [{ ticker: 'asc' }, { id: 'asc' }],
        });

        return instruments.map(
          (instrument) =>
            new InstrumentRepositoryResponseDto(
              instrument.id,
              instrument.ticker,
              instrument.name,
              instrument.type,
            ),
        );
      },
    );
  }
}
