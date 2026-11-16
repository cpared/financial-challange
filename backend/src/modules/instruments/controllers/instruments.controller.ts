import { Controller, Get, Query } from '@nestjs/common';
import { InstrumentResponseDto } from './dto/instrument-response.dto.js';
import { SearchInstrumentsRequestDto } from './dto/search-instruments-request.dto.js';
import { InstrumentsService } from '../services/instruments.service.js';

@Controller('instruments')
export class InstrumentsController {
  constructor(private readonly instrumentsService: InstrumentsService) {}

  @Get()
  async search(
    @Query() request: SearchInstrumentsRequestDto,
  ): Promise<InstrumentResponseDto[]> {
    const results = await this.instrumentsService.search(request.query);
    return results.map((instrument) => InstrumentResponseDto.map(instrument));
  }
}
