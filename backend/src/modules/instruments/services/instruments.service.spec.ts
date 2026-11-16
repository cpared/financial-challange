import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { InstrumentsRepository } from '../repositories/instruments.repository.js';
import { InstrumentRepositoryResponseDto } from '../repositories/dto/instrument-repository-response.dto.js';
import { InstrumentsService } from './instruments.service.js';
import { TelemetryService } from '../../../common/observability/telemetry.service.js';

describe('InstrumentsService', () => {
  let service: InstrumentsService;
  const repository = {
    search: jest.fn<InstrumentsRepository['search']>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        InstrumentsService,
        { provide: InstrumentsRepository, useValue: repository },
        TelemetryService,
      ],
    }).compile();
    service = module.get(InstrumentsService);
  });

  it('maps repository instruments into service responses', async () => {
    repository.search.mockResolvedValue([
      new InstrumentRepositoryResponseDto(
        1,
        'BBAR',
        'Banco Frances',
        'ACCIONES',
      ),
    ]);

    await expect(service.search('BB')).resolves.toMatchObject([
      { id: 1, ticker: 'BBAR', name: 'Banco Frances', type: 'ACCIONES' },
    ]);
    expect(repository.search).toHaveBeenCalledWith('BB');
  });
});
