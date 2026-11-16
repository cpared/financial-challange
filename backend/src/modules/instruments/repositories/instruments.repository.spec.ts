import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../database/prisma.service.js';
import { InstrumentsRepository } from './instruments.repository.js';
import { TelemetryService } from '../../../common/observability/telemetry.service.js';

describe('InstrumentsRepository', () => {
  let repository: InstrumentsRepository;
  const prisma = {
    instrument: {
      findMany: jest.fn<PrismaService['instrument']['findMany']>(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        InstrumentsRepository,
        { provide: PrismaService, useValue: prisma },
        TelemetryService,
      ],
    }).compile();
    repository = module.get(InstrumentsRepository);
  });

  it('performs case-insensitive partial matching and maps Prisma results', async () => {
    prisma.instrument.findMany.mockResolvedValue([
      { id: 1, ticker: 'BBAR', name: 'Banco Frances', type: 'ACCIONES' },
    ]);

    await expect(repository.search('bb')).resolves.toMatchObject([
      { id: 1, ticker: 'BBAR', name: 'Banco Frances' },
    ]);
    expect(prisma.instrument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { ticker: { contains: 'bb', mode: 'insensitive' } },
            { name: { contains: 'bb', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });
});
