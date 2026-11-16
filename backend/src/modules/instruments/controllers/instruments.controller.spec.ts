import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { InstrumentResponseDto } from './dto/instrument-response.dto.js';
import { InstrumentsController } from './instruments.controller.js';
import { InstrumentsService } from '../services/instruments.service.js';
import { InstrumentServiceResponseDto } from '../services/dto/instrument-service-response.dto.js';

describe('InstrumentsController', () => {
  let controller: InstrumentsController;
  const instrumentsService = {
    search: jest.fn<InstrumentsService['search']>(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [InstrumentsController],
      providers: [
        { provide: InstrumentsService, useValue: instrumentsService },
      ],
    }).compile();
    controller = module.get(InstrumentsController);
  });

  it('maps service results to the HTTP response DTO', async () => {
    instrumentsService.search.mockResolvedValue([
      new InstrumentServiceResponseDto(1, 'BBAR', 'Banco Frances', 'ACCIONES'),
    ]);

    await expect(controller.search({ query: 'BB' })).resolves.toEqual([
      new InstrumentResponseDto(1, 'BBAR', 'Banco Frances', 'ACCIONES'),
    ]);
    expect(instrumentsService.search).toHaveBeenCalledWith('BB');
  });
});
